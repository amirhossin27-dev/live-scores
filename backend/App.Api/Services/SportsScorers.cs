using System.Globalization;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;

namespace Standalone.Api.Services;

/// <summary>Season totals for one player. Missing counts are unknown, never an assumed zero.</summary>
public sealed record SportsScorer(string Id, string Name, string? Team, string? TeamId, int? Goals, int? Assists, int? Scorings, SportsCountry? Country = null, string? TeamLogo = null, bool HasProfile = true);

/// <summary>All contributors published by the source, refreshed every 30 seconds. UpdatedAt is the fetch time, not the time of the last goal.</summary>
public sealed record SportsScorers(string Competition, string? Season, DateTimeOffset UpdatedAt, string Source, bool Available, IReadOnlyList<SportsScorer> Players, IReadOnlyList<string>? Seasons = null);

public sealed partial class SportsService
{
    public Task<SportsScorers?> GetScorersAsync(string competition, string? season, CancellationToken cancellationToken) =>
        fotMob is not null && FotMobLeagues.TryGetValue(competition, out var leagueId)
            ? fotMob.GetScorersAsync(competition, leagueId, season, cancellationToken)
            : Task.FromResult<SportsScorers?>(new SportsScorers(competition, season, DateTimeOffset.UtcNow, "fotmob", false, []));
}

public sealed partial class FotMobService
{
    private static readonly string[] ScorerStatKeys = ["goals", "goal_assist", "_goals_and_goal_assist"];

    public async Task<SportsScorers?> GetScorersAsync(string competition, int leagueId, string? season, CancellationToken cancellationToken)
    {
        var requestedSeason = NormalizePlayerSeason(season);
        return await cache.GetOrCreateAsync($"fotmob:scorers:{competition}:{requestedSeason}", async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = LiveCache;
            try
            {
                var url = $"{Api}/leagues?id={leagueId}" + (requestedSeason is null ? "" : $"&season={Uri.EscapeDataString(requestedSeason)}");
                using var leagueResponse = await http.GetAsync(url, cancellationToken);
                leagueResponse.EnsureSuccessStatusCode();
                using var document = JsonDocument.Parse(await leagueResponse.Content.ReadAsStringAsync(cancellationToken));
                var root = document.RootElement;
                var selectedSeason = TryChild(root, "details", out var details) ? NormalizePlayerSeason(Text(details, "selectedSeason")) : null;
                var catalog = transfermarkt is null ? null : await transfermarkt.GetArchiveCatalogAsync(competition, cancellationToken);
                var availableSeasons = SportsSeasons.Combine(SportsSeasons.FotMob(root, true), catalog?.Seasons.Select(item => item.Name) ?? []);
                async Task<SportsScorers?> HistoricalOrUnavailable(string? target)
                {
                    var archived = await ArchiveScorersAsync(competition, target, availableSeasons, cancellationToken);
                    if (archived is not null) return archived;
                    if (transfermarkt is not null && TransfermarktService.SupportsArchive(competition)
                        && (catalog is null || catalog.Seasons.Any(item => item.Name == target))) return null;
                    return new SportsScorers(competition, target, DateTimeOffset.UtcNow, "fotmob", false, [], availableSeasons);
                }
                if (requestedSeason is not null && selectedSeason != requestedSeason)
                    return await HistoricalOrUnavailable(requestedSeason);

                var links = ScorerLinks(root, leagueId);
                if (links.Count == 0)
                    return await HistoricalOrUnavailable(selectedSeason);

                // Fetch the full lists, not the league page's topThree snippets. The assists and combined leaders
                // can be absent from the goals list, and must remain available when the user changes the sorting.
                var lists = await Task.WhenAll(links.Select(async link =>
                {
                    using var response = await http.GetAsync(link.Value, cancellationToken);
                    response.EnsureSuccessStatusCode();
                    return new KeyValuePair<string, string>(link.Key, await response.Content.ReadAsStringAsync(cancellationToken));
                }));
                var players = ParseScorers(lists.ToDictionary(pair => pair.Key, pair => pair.Value, StringComparer.Ordinal));
                return new SportsScorers(competition, selectedSeason, DateTimeOffset.UtcNow, "fotmob", true, players, availableSeasons);
            }
            catch (Exception exception) when (exception is HttpRequestException or JsonException or InvalidOperationException or TaskCanceledException && !cancellationToken.IsCancellationRequested)
            {
                System.Diagnostics.Trace.TraceWarning("Data source request failed: {0}", exception.GetType().Name);
                return await ArchiveScorersAsync(competition, requestedSeason, [], cancellationToken);
            }
        });
    }

    private async Task<SportsScorers?> ArchiveScorersAsync(string competition, string? season, IReadOnlyList<string> seasons, CancellationToken cancellationToken)
    {
        var archived = transfermarkt is null ? null : await transfermarkt.GetArchiveScorersAsync(competition, season, cancellationToken);
        return archived is null ? null : archived with { Seasons = SportsSeasons.Combine(seasons, archived.Seasons ?? []) };
    }

    private static Dictionary<string, string> ScorerLinks(JsonElement root, int leagueId)
    {
        var links = new Dictionary<string, string>(StringComparer.Ordinal);
        if (!TryChild(root, "stats", out var stats) || !TryChild(stats, "players", out var players) || players.ValueKind != JsonValueKind.Array) return links;
        string? seasonId = null;
        foreach (var stat in players.EnumerateArray())
        {
            var key = Text(stat, "name");
            if (key is null || !ScorerStatKeys.Contains(key)) continue;
            var url = Text(stat, "fetchAllUrl");
            if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps || uri.Host != "data.fotmob.com"
                || !uri.IsDefaultPort || uri.UserInfo.Length > 0 || uri.Query.Length > 0 || uri.Fragment.Length > 0)
                throw new JsonException("The scorer list URL does not point to the statistics source.");
            var path = uri.AbsolutePath.Split('/');
            if (path.Length != 6 || path[1] != "stats" || path[2] != leagueId.ToString(CultureInfo.InvariantCulture)
                || path[3] != "season" || !IsValidPlayerId(path[4]) || path[5] != $"{key}.json")
                throw new JsonException("The scorer list belongs to a different competition or statistic.");
            if (seasonId is not null && seasonId != path[4]) throw new JsonException("Scorer lists belong to different seasons.");
            seasonId = path[4];
            links[key] = uri.AbsoluteUri;
        }
        return links;
    }

    /// <summary>Merge FotMob's complete goals, assists and combined lists by player id, including providers' explicit zero values.</summary>
    public static IReadOnlyList<SportsScorer> ParseScorers(IReadOnlyDictionary<string, string> lists)
    {
        var rows = new Dictionary<string, SportsScorer>(StringComparer.Ordinal);
        // Read the combined list first so its identity/team labels win if independent source caches differ.
        foreach (var key in ScorerStatKeys.Reverse())
        {
            if (!lists.TryGetValue(key, out var json)) continue;
            using var document = JsonDocument.Parse(json);
            if (!TryChild(document.RootElement, "TopLists", out var topLists) || topLists.ValueKind != JsonValueKind.Array)
                throw new JsonException("The scorer list is missing.");
            var matching = topLists.EnumerateArray().Where(list => Text(list, "StatName") == key).ToArray();
            if (matching.Length != 1 || !TryChild(matching[0], "StatList", out var players) || players.ValueKind != JsonValueKind.Array)
                throw new JsonException("The expected scorer statistic is missing.");
            var seen = new Dictionary<string, int?>(StringComparer.Ordinal);
            foreach (var player in players.EnumerateArray())
            {
                // The misspelled ParticiantId is the source's published field name.
                var id = Text(player, "ParticiantId") ?? Text(player, "ParticipantId");
                var name = Text(player, "ParticipantName");
                if (!IsValidPlayerId(id) || string.IsNullOrWhiteSpace(name)) continue;
                var value = ScorerCount(player, "StatValue");
                if (seen.TryGetValue(id!, out var earlier) && earlier != value)
                    throw new JsonException("Conflicting totals for the same player.");
                seen[id!] = value;
                var teamId = Text(player, "TeamId");
                if (!rows.TryGetValue(id!, out var row))
                    row = new SportsScorer(id!, name.Trim(), Text(player, "TeamName"), IsValidTeamId(teamId) ? teamId : null, null, null, null);
                // The nationality belongs to the player, not their club's country.
                row = row with { Country = row.Country ?? SportsCountries.FromCode(Text(player, "ParticipantCountryCode"), null) };
                rows[id!] = key switch
                {
                    "goals" => row with { Goals = value },
                    "goal_assist" => row with { Assists = value },
                    _ => row with { Scorings = value },
                };
            }
        }

        return rows.Values.Select(CompleteScorer).OrderByDescending(row => row.Goals)
            .ThenByDescending(row => row.Assists).ThenBy(row => row.Name, StringComparer.Ordinal).ToArray();
    }

    private static int? ScorerCount(JsonElement player, string property) =>
        Number(player, property) is { } value && value >= 0 && value <= int.MaxValue && value == Math.Truncate(value) ? (int)value : null;

    private static SportsScorer CompleteScorer(SportsScorer row)
    {
        // Absence from a ranking is not proof of zero. An explicit total and one known component are.
        if (row.Goals is null && row.Scorings is { } totalGoals && row.Assists is { } assists && totalGoals >= assists)
            row = row with { Goals = totalGoals - assists };
        if (row.Assists is null && row.Scorings is { } totalAssists && row.Goals is { } goals && totalAssists >= goals)
            row = row with { Assists = totalAssists - goals };
        // Goals + assists is the UI's defined total, even if the aggregate source cache lags behind either component.
        if (row.Goals is { } knownGoals && row.Assists is { } knownAssists)
            row = row with { Scorings = (long)knownGoals + knownAssists <= int.MaxValue ? knownGoals + knownAssists : null };
        return row;
    }
}
