using System.Globalization;
using System.Text.Json;

namespace Standalone.Api.Services;

/// <summary>What FotMob's match page says about a match: its league (and the parent league of a stage), the kick-off and the two teams.</summary>
public sealed record FotMobMatchSummary(string Id, int? LeagueId, int? ParentLeagueId, DateTimeOffset Start, string Home, string Away);

/// <summary>A match of FotMob (a team page, a player profile, the form in a table) found in ESPN's scores: the competition and the match.</summary>
public sealed record SportsMatchLink(string Competition, SportsMatch Match);

/// <summary>A season of a player's statistics at FotMob with its competitions; <c>Entry</c> asks FotMob for the figures of one of them.</summary>
public sealed record SportsPlayerSeason(string Name, IReadOnlyList<SportsPlayerSeasonEntry> Competitions);

public sealed record SportsPlayerSeasonEntry(string Entry, string Name);

public sealed partial class FotMobService
{
    public static bool IsValidSeasonEntry(string? entry) => !string.IsNullOrEmpty(entry) && SeasonEntryPattern().IsMatch(entry);

    /// <summary>The league, the kick-off and the teams of a FotMob match (the same cached page the line-ups come from).</summary>
    public async Task<FotMobMatchSummary?> GetMatchSummaryAsync(string id, CancellationToken cancellationToken)
    {
        var json = await GetCachedAsync($"fotmob:match:{id}", $"{Api}/matchDetails?matchId={id}", MatchCache, cancellationToken);
        return json is null ? null : ParseMatchSummary(json);
    }

    public static FotMobMatchSummary? ParseMatchSummary(string json)
    {
        using var document = JsonDocument.Parse(json);
        if (!TryChild(document.RootElement, "general", out var general) || general.ValueKind != JsonValueKind.Object) return null;
        var id = Text(general, "matchId");
        var home = TryChild(general, "homeTeam", out var homeTeam) ? Text(homeTeam, "name") : null;
        var away = TryChild(general, "awayTeam", out var awayTeam) ? Text(awayTeam, "name") : null;
        if (id is null || home is null || away is null) return null;
        if (!DateTimeOffset.TryParse(Text(general, "matchTimeUTCDate"), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var start)) return null;
        return new FotMobMatchSummary(id, Whole(general, "leagueId"), Whole(general, "parentLeagueId"), start, home.Trim(), away.Trim());
    }

    /// <summary>The headline figures of one season and competition of a player (goals, assists, rating, matches, starts, minutes).</summary>
    public async Task<IReadOnlyList<SportsSeasonStat>?> GetPlayerSeasonAsync(string id, string entry, CancellationToken cancellationToken)
    {
        var json = await GetCachedAsync($"fotmob:player-season:{id}:{entry}", $"{Api}/playerStats?playerId={id}&seasonId={entry}", PlayerCache, cancellationToken);
        if (json is null) return null;
        var stats = ParsePlayerSeason(json).ToList();
        if (new[] { "goals", "assists", "red_cards" }.All(key => stats.Any(stat => stat.Key == key))) return stats;
        var profileJson = await GetCachedAsync($"fotmob:player:{id}", $"{Api}/playerData?id={id}", PlayerCache, cancellationToken);
        if (profileJson is null) return stats;
        using var profileDocument = JsonDocument.Parse(profileJson);
        var (season, league) = PlayerSeasonSelection(profileDocument.RootElement, entry);
        CompletePlayerSeasonCounts(stats, profileDocument.RootElement, season, league);
        return stats;
    }

    public static IReadOnlyList<SportsSeasonStat> ParsePlayerSeason(string json)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        var stats = new List<SportsSeasonStat>();
        if (TryChild(root, "topStatCard", out var card) && TryChild(card, "items", out var items) && items.ValueKind == JsonValueKind.Array)
            foreach (var item in items.EnumerateArray())
                if (ReadSeasonStat(item, "statValue") is { } stat && !stats.Any(existing => existing.Key == stat.Key)) stats.Add(stat);
        // Discipline is published in the detailed section, not in the headline card; preserve real zero values too.
        if (TryChild(root, "statsSection", out var section) && TryChild(section, "items", out var groups) && groups.ValueKind == JsonValueKind.Array)
        {
            AddMissingSeasonCounts(stats, groups, "statValue");
            foreach (var group in groups.EnumerateArray())
                if (TryChild(group, "items", out var details)) AddMissingSeasonCounts(stats, details, "statValue");
        }
        return stats;
    }
    /// <summary>The seasons of the player's statistics, newest first, and the entry of the season the profile shows (its main league).</summary>
    private static (IReadOnlyList<SportsPlayerSeason> Seasons, string? Current) StatSeasons(JsonElement root)
    {
        if (!TryChild(root, "statSeasons", out var seasons) || seasons.ValueKind != JsonValueKind.Array) return ([], null);
        var mainLeague = TryChild(root, "mainLeague", out var main) ? Text(main, "leagueId") : null;
        var mainSeason = TryChild(root, "mainLeague", out main) ? Text(main, "season") : null;
        var list = new List<SportsPlayerSeason>();
        string? current = null;
        foreach (var season in seasons.EnumerateArray())
        {
            var name = Text(season, "seasonName");
            if (name is null || !TryChild(season, "tournaments", out var tournaments) || tournaments.ValueKind != JsonValueKind.Array) continue;
            var entries = new List<SportsPlayerSeasonEntry>();
            foreach (var tournament in tournaments.EnumerateArray())
            {
                var entry = Text(tournament, "entryId");
                var title = Text(tournament, "name");
                if (!IsValidSeasonEntry(entry) || string.IsNullOrWhiteSpace(title)) continue;
                entries.Add(new SportsPlayerSeasonEntry(entry!, title.Trim()));
                if (current is null && name == mainSeason && Text(tournament, "tournamentId") == mainLeague) current = entry;
            }

            if (entries.Count > 0) list.Add(new SportsPlayerSeason(name, entries));
        }

        return (list, current);
    }

    /// <summary>All matches of a league's season (FotMob's fixtures), oldest first; <c>Result</c> stays null (it depends on the team).</summary>
    private static IReadOnlyList<SportsTeamFixture> LeagueFixtures(JsonElement root, string? competition)
    {
        if (!TryChild(root, "fixtures", out var fixtures) || !TryChild(fixtures, "allMatches", out var all) || all.ValueKind != JsonValueKind.Array) return [];
        var list = new List<SportsTeamFixture>();
        foreach (var match in all.EnumerateArray())
        {
            var id = Text(match, "id");
            if (!IsValidPlayerId(id) || !TryChild(match, "status", out var status) || UtcText(status) is not { } start) continue;
            var (state, text) = FixtureStatus(status);
            int? homeScore = null, awayScore = null;
            var parts = (Text(status, "scoreStr") ?? string.Empty).Split('-', StringSplitOptions.TrimEntries);
            if (state is "live" or "finished" && parts.Length == 2 && int.TryParse(parts[0], out var left) && int.TryParse(parts[1], out var right)) (homeScore, awayScore) = (left, right);
            if (LeagueSide(match, "home", homeScore) is not { } home || LeagueSide(match, "away", awayScore) is not { } away) continue;
            list.Add(new SportsTeamFixture(id!, start, competition ?? string.Empty, home, away, state, text, null));
        }

        return list.OrderBy(fixture => fixture.Start).ToArray();
    }

    private static SportsTeamSide? LeagueSide(JsonElement match, string property, int? score)
    {
        if (!TryChild(match, property, out var side) || Text(side, "name") is not { Length: > 0 } name) return null;
        var id = Text(side, "id");
        var real = RealTeam(id) && IsValidTeamId(id);
        return new SportsTeamSide(real ? id : null, name.Trim(), real ? Crest(id!) : null, score);
    }

    [System.Text.RegularExpressions.GeneratedRegex(@"^\d{1,3}-\d{1,3}$", System.Text.RegularExpressions.RegexOptions.CultureInvariant)]
    private static partial System.Text.RegularExpressions.Regex SeasonEntryPattern();
}

public sealed partial class SportsService
{
    /// <summary>How many finished matches the form of a table row shows.</summary>
    public const int FormLength = 5;

    /// <summary>
    /// A FotMob match in ESPN's scores, so that it opens the match panel: FotMob's league (or the parent league of a stage) gives the
    /// competition, the kick-off and the team names give the match (ESPN files a late match under the day before in US time, so the
    /// days around the kick-off are searched too). Null when the competition is not in the catalog or ESPN does not have the match.
    /// </summary>
    public async Task<SportsMatchLink?> FindMatchAsync(string fotMobId, CancellationToken cancellationToken)
    {
        if (fotMob is null || await fotMob.GetMatchSummaryAsync(fotMobId, cancellationToken) is not { } summary) return null;
        var competition = CompetitionOf(summary.LeagueId) ?? CompetitionOf(summary.ParentLeagueId);
        if (competition is null) return null;

        var day = summary.Start.UtcDateTime.Date;
        foreach (var date in new[] { day, day.AddDays(-1), day.AddDays(1) })
        {
            var scores = await GetCompetitionAsync(competition, date.ToString("yyyyMMdd", CultureInfo.InvariantCulture), cancellationToken);
            if (scores is null) continue;
            var listed = scores.Matches
                .Where(match => match.Home is not null && match.Away is not null)
                .Select(match => new FotMobService.ListedMatch(match.Id, match.Start, Names(match.Home!), Names(match.Away!)))
                .ToArray();
            if (FotMobService.FindMatch(listed, summary.Start, summary.Home, summary.Away) is { } id) return new SportsMatchLink(competition, scores.Matches.First(match => match.Id == id));
        }

        return null;

        static IReadOnlyList<string> Names(SportsSide side) => new[] { side.Name, side.ShortName }.OfType<string>().ToArray();
    }

    /// <summary>The competition of the catalog that FotMob's league id stands for.</summary>
    public static string? CompetitionOf(int? leagueId) =>
        leagueId is 9807 or 9808 or 9809 ? "soccer/uefa.nations"
        : leagueId is null ? null : FotMobLeagues.FirstOrDefault(pair => pair.Value == leagueId).Key;

    /// <summary>
    /// The form of each team with FotMob's id: its last finished matches of the competition (newest first) and the next match (the
    /// running one, else the next one scheduled), with the result seen from the team.
    /// </summary>
    public static SportsTable AttachForm(SportsTable table, IReadOnlyList<SportsTeamFixture> fixtures)
    {
        if (fixtures.Count == 0) return table;
        return table with
        {
            Groups = table.Groups.Select(group => group with
            {
                Rows = group.Rows.Select(row =>
                {
                    if (row.TeamId is not { } id) return row;
                    var own = fixtures.Where(fixture => fixture.Home.Id == id || fixture.Away.Id == id).ToArray();
                    if (own.Length == 0) return row;
                    var form = own.Where(fixture => fixture.Status == "finished").Reverse().Take(FormLength).Select(fixture => fixture with { Result = Result(fixture, id) }).ToArray();
                    var next = own.FirstOrDefault(fixture => fixture.Status == "live") ?? own.FirstOrDefault(fixture => fixture.Status == "scheduled");
                    return row with { Form = form, Next = next };
                }).ToArray(),
            }).ToArray(),
        };

        static string? Result(SportsTeamFixture fixture, string id)
        {
            if (fixture.Home.Score is not { } home || fixture.Away.Score is not { } away) return null;
            var (own, other) = fixture.Home.Id == id ? (home, away) : (away, home);
            return own > other ? "win" : own < other ? "loss" : "draw";
        }
    }
}
