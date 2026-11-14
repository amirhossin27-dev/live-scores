using System.Globalization;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;

namespace Standalone.Api.Services;

/// <summary>A searchable football person or team, using FotMob ids that open the existing profile panels.</summary>
public sealed record SportsSearchResult(string Id, string Name, string Kind, string? Description, string? Logo, SportsCountry? Country);

/// <summary>Actual figures published for a team in one season, never estimated from the totals of a career stint.</summary>
public sealed record SportsCareerSeasonTeam(string Team, string? TeamId, string? Logo, string Kind, int? Appearances, int? Goals, int? Assists);
public sealed record SportsCareerSeason(string Season, IReadOnlyList<SportsCareerSeasonTeam> Teams);

public sealed partial class FotMobService
{
    public const int MaxSearchResults = 24;
    private static readonly TimeSpan SearchCache = TimeSpan.FromMinutes(10);

    public static bool IsValidSearchQuery(string? query) => query?.Trim() is { Length: >= 2 and <= 80 } text
        && !text.Any(char.IsControl) && text.Any(char.IsLetterOrDigit);

    public async Task<IReadOnlyList<SportsSearchResult>?> SearchAsync(string query, string language, CancellationToken cancellationToken)
    {
        if (!IsValidSearchQuery(query) || language is not ("de" or "en")) return null;
        var term = query.Trim();
        var json = await GetCachedAsync($"fotmob:search:{language}:{term.ToUpperInvariant()}",
            $"{Api}/search/suggest?term={Uri.EscapeDataString(term)}&lang={language}", SearchCache, cancellationToken);
        if (json is null) return null;
        using var document = JsonDocument.Parse(json);
        return document.RootElement.ValueKind == JsonValueKind.Array ? ParseSearch(json) : null;
    }

    public static IReadOnlyList<SportsSearchResult> ParseSearch(string json)
    {
        using var document = JsonDocument.Parse(json);
        if (document.RootElement.ValueKind != JsonValueKind.Array) return [];
        var results = new List<SportsSearchResult>();
        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var group in document.RootElement.EnumerateArray())
        {
            if (!TryChild(group, "suggestions", out var suggestions) || suggestions.ValueKind != JsonValueKind.Array) continue;
            foreach (var item in suggestions.EnumerateArray())
            {
                var id = Text(item, "id");
                var name = Text(item, "name");
                var type = Text(item, "type");
                if (!IsValidPlayerId(id) || string.IsNullOrWhiteSpace(name) || type is not ("player" or "team")) continue;
                var coach = TryChild(item, "isCoach", out var isCoach) && isCoach.ValueKind == JsonValueKind.True;
                // FotMob's search uses leagueId 0 for national sides, including women and youth teams.
                var kind = type == "player" ? coach ? "coach" : "player" : Whole(item, "leagueId") == 0 ? "national" : "club";
                if (!seen.Add($"{type}:{id}")) continue;
                var description = type == "player" ? Text(item, "teamName") : Text(item, "leagueName");
                var country = SportsCountries.FromCode(Text(item, "ccode"), Text(item, "countryName"));
                if (kind == "national" && country is null)
                {
                    var countryName = System.Text.RegularExpressions.Regex.Replace(name.Trim(), @"\s+(?:U\d{2}|\(W\))$", string.Empty);
                    var known = SportsCountries.FromName(countryName);
                    if (known?.Code is not null) country = known;
                }
                results.Add(new SportsSearchResult(id!, name.Trim(), kind, string.IsNullOrWhiteSpace(description) ? null : description.Trim(),
                    type == "team" ? TeamLogo(id!) : $"https://images.fotmob.com/image_resources/playerimages/{id}.png", country));
                if (results.Count == MaxSearchResults) return results;
            }
        }
        return results;
    }

    private static IReadOnlyList<SportsCareerSeason> CareerSeasons(JsonElement root)
    {
        if (!TryChild(root, "careerHistory", out var history) || !TryChild(history, "careerItems", out var items)) return [];
        var seasons = new Dictionary<string, List<SportsCareerSeasonTeam>>(StringComparer.Ordinal);
        foreach (var (property, kind) in new[] { ("senior", "club"), ("national team", "national") })
        {
            if (!TryChild(items, property, out var group) || !TryChild(group, "seasonEntries", out var entries) || entries.ValueKind != JsonValueKind.Array) continue;
            foreach (var entry in entries.EnumerateArray())
            {
                var season = Text(entry, "seasonName");
                var team = Text(entry, "team");
                if (string.IsNullOrWhiteSpace(season) || string.IsNullOrWhiteSpace(team)) continue;
                var id = IsValidTeamId(Text(entry, "teamId")) ? Text(entry, "teamId") : null;
                if (!seasons.TryGetValue(season, out var teams)) seasons[season] = teams = [];
                teams.Add(new SportsCareerSeasonTeam(team.Trim(), id, id is null ? null : TeamLogo(id), kind,
                    WholeText(entry, "appearances"), WholeText(entry, "goals"), WholeText(entry, "assists")));
            }
        }
        return seasons.OrderByDescending(item => item.Key, StringComparer.Ordinal)
            .Select(item => new SportsCareerSeason(item.Key, item.Value)).ToArray();
    }

    public static string? NormalizePlayerSeason(string? season)
    {
        if (season is null) return null;
        var parts = season.Replace('-', '/').Split('/');
        if (parts.Length == 1) return parts[0];
        if (parts.Length != 2 || parts[0].Length != 4 || parts[1].Length is not (2 or 4)
            || !int.TryParse(parts[0], NumberStyles.None, CultureInfo.InvariantCulture, out var year)
            || !int.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out var last)) return null;
        if (parts[1].Length == 2) last += year / 100 * 100 + (last < year % 100 ? 100 : 0);
        return last == year + 1 ? $"{year}/{last}" : null;
    }

    /// <summary>Calendar years or July-to-June league seasons; the source's calendar-year tournament labels override this default.</summary>
    public static bool TryPlayerSeasonDates(string? season, out DateTimeOffset from, out DateTimeOffset until)
    {
        from = until = default;
        var normalized = NormalizePlayerSeason(season);
        if (normalized is null || normalized.Length is not (4 or 9)) return false;
        var parts = normalized.Split('/');
        if (!int.TryParse(parts[0], NumberStyles.None, CultureInfo.InvariantCulture, out var year) || year is < 1900 or > 2200) return false;
        from = new DateTimeOffset(year, parts.Length == 1 ? 1 : 7, 1, 0, 0, 0, TimeSpan.Zero);
        until = from.AddYears(1);
        return true;
    }

    private static Dictionary<string, List<(DateTimeOffset From, DateTimeOffset Until)>> CompetitionSeasonDates(JsonElement profile, string season, out HashSet<string> knownLeagues)
    {
        knownLeagues = new HashSet<string>(StringComparer.Ordinal);
        var normalized = NormalizePlayerSeason(season);
        var listed = new HashSet<string>(StringComparer.Ordinal);
        if (TryChild(profile, "statSeasons", out var seasons) && seasons.ValueKind == JsonValueKind.Array)
            foreach (var item in seasons.EnumerateArray())
                if (NormalizePlayerSeason(Text(item, "seasonName")) == normalized && TryChild(item, "tournaments", out var tournaments) && tournaments.ValueKind == JsonValueKind.Array)
                    foreach (var tournament in tournaments.EnumerateArray())
                        if (Text(tournament, "tournamentId") is { } id) listed.Add(id);
        var dates = new Dictionary<string, List<(DateTimeOffset, DateTimeOffset)>>(StringComparer.Ordinal);
        if (!TryChild(profile, "careerHistory", out var history) || !TryChild(history, "careerItems", out var items)) return dates;
        foreach (var property in new[] { "senior", "national team" })
        {
            if (!TryChild(items, property, out var group) || !TryChild(group, "seasonEntries", out var entries) || entries.ValueKind != JsonValueKind.Array) continue;
            foreach (var entry in entries.EnumerateArray())
            {
                var entrySeason = NormalizePlayerSeason(Text(entry, "seasonName"));
                if (!TryChild(entry, "tournamentStats", out var stats) || stats.ValueKind != JsonValueKind.Array) continue;
                foreach (var stat in stats.EnumerateArray())
                {
                    var league = Text(stat, "leagueId");
                    var tournamentSeason = NormalizePlayerSeason(Text(stat, "seasonName")) ?? entrySeason;
                    if (league is null || !TryPlayerSeasonDates(tournamentSeason, out var start, out var end)) continue;
                    knownLeagues.Add(league);
                    // E.g. World Cup 2026 is listed under 2026/2027 by statSeasons, but its published season is 2026.
                    if (entrySeason != normalized && !(listed.Contains(league) && (tournamentSeason == normalized || tournamentSeason == normalized?[..4]))) continue;
                    if (!dates.TryGetValue(league, out var windows)) dates[league] = windows = [];
                    if (!windows.Contains((start, end))) windows.Add((start, end));
                }
            }
        }
        return dates;
    }
    /// <summary>
    /// All source match records within the selected season, including unused-bench entries. Fetches previous pages through
    /// FotMob's own proxy, starting at the season's upper boundary. A failed page never becomes a misleading partial season.
    /// </summary>
    public async Task<IReadOnlyList<SportsPlayerMatch>?> GetPlayerMatchesAsync(string id, string season, CancellationToken cancellationToken)
    {
        if (!IsValidPlayerId(id) || !TryPlayerSeasonDates(season, out var from, out var until)) return null;
        season = NormalizePlayerSeason(season)!;
        return await cache.GetOrCreateAsync<IReadOnlyList<SportsPlayerMatch>?>($"fotmob:player-matches:{id}:{season}", async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = from <= DateTimeOffset.UtcNow && DateTimeOffset.UtcNow < until ? MatchCache : PlayerCache;
            var profileJson = await GetCachedAsync($"fotmob:player:{id}", $"{Api}/playerData?id={id}", PlayerCache, cancellationToken);
            if (profileJson is null)
            {
                entry.AbsoluteExpirationRelativeToNow = FailureCache;
                return null;
            }
            using var profileDocument = JsonDocument.Parse(profileJson);
            var competitionDates = CompetitionSeasonDates(profileDocument.RootElement, season, out var knownLeagues);
            var sourceFrom = competitionDates.Values.SelectMany(windows => windows).Select(window => window.From).Append(from).Min();
            var sourceUntil = competitionDates.Values.SelectMany(windows => windows).Select(window => window.Until).Append(until).Max();
            var matches = new Dictionary<string, SportsPlayerMatch>(StringComparer.Ordinal);
            var before = sourceUntil.ToUnixTimeSeconds();
            // Twenty records per page at the source; this bound also prevents a broken cursor from looping indefinitely.
            for (var page = 0; page < 20; page++)
            {
                var publicUrl = $"https://pub.fotmob.com/prod/db/api/player/{id}/matches?before={before}";
                var json = await GetCachedAsync($"fotmob:player-matches-page:{id}:{before}",
                    $"{Api}/playerMatches?url={Uri.EscapeDataString(publicUrl)}", entry.AbsoluteExpirationRelativeToNow!.Value, cancellationToken);
                if (json is null)
                {
                    entry.AbsoluteExpirationRelativeToNow = FailureCache;
                    return null;
                }
                using var document = JsonDocument.Parse(json);
                var root = document.RootElement;
                if (!TryChild(root, "matches", out var records) || records.ValueKind != JsonValueKind.Array)
                {
                    entry.AbsoluteExpirationRelativeToNow = FailureCache;
                    return null;
                }
                var parsed = RecentMatches(root, "matches", int.MaxValue);
                var leagueIds = records.EnumerateArray().Where(record => Text(record, "id") is not null)
                    .GroupBy(record => Text(record, "id")!).ToDictionary(group => group.Key, group => Text(group.First(), "leagueId"));
                foreach (var match in parsed)
                {
                    var leagueId = leagueIds.GetValueOrDefault(match.Id);
                    var belongs = leagueId is not null && competitionDates.TryGetValue(leagueId, out var windows)
                        ? windows.Any(window => match.Date >= window.From && match.Date < window.Until)
                        : (leagueId is null || !knownLeagues.Contains(leagueId)) && match.Date >= from && match.Date < until;
                    if (belongs) matches.TryAdd(match.Id, match);
                }
                if (records.GetArrayLength() == 0 || parsed.Count > 0 && parsed.Min(match => match.Date) < sourceFrom || string.IsNullOrWhiteSpace(Text(root, "previous")))
                    return matches.Values.OrderByDescending(match => match.Date).ToArray();
                // Only extract the numeric cursor. Never request an arbitrary URL supplied in upstream JSON.
                if (!TryPreviousMatchesCursor(Text(root, "previous"), id, before, out var previous)) break;
                before = previous;
            }
            entry.AbsoluteExpirationRelativeToNow = FailureCache;
            return null;
        });
    }

    public static bool TryPreviousMatchesCursor(string? previous, string id, long current, out long before)
    {
        before = default;
        if (!Uri.TryCreate(previous, UriKind.Absolute, out var url) || url.Scheme != "https" || url.Host != "pub.fotmob.com"
            || url.AbsolutePath != $"/prod/db/api/player/{id}/matches") return false;
        var query = Microsoft.AspNetCore.WebUtilities.QueryHelpers.ParseQuery(url.Query);
        return query.TryGetValue("before", out var value) && long.TryParse(value.ToString(), NumberStyles.None, CultureInfo.InvariantCulture, out before)
            && before >= 0 && before < current;
    }
}
