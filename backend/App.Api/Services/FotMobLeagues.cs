using System.Globalization;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;

namespace Standalone.Api.Services;

/// <summary>What FotMob has about a competition: the season, its table (used when ESPN has none), its knock-out tree and all its matches.</summary>
public sealed record FotMobLeague(string? Season, SportsTable? Table, SportsBracket? Bracket, IReadOnlyList<SportsTeamFixture>? Fixtures = null, IReadOnlyList<string>? Seasons = null);

/// <summary>Tables and knock-out trees of football competitions from FotMob's league page (<c>/api/data/leagues?id=</c>).</summary>
public sealed partial class FotMobService
{
    private static readonly TimeSpan LeagueCache = TimeSpan.FromMinutes(10);

    private static readonly string[] TableColumns = ["gamesPlayed", "wins", "ties", "losses", "goals", "goalDifference", "points"];

    /// <summary>The league, parsed and cached (the page is several hundred kilobytes); null when FotMob does not answer.</summary>
    public async Task<FotMobLeague?> GetLeagueAsync(int leagueId, CancellationToken cancellationToken, string? season = null) =>
        await cache.GetOrCreateAsync($"fotmob:league:{leagueId}:{SportsSeasons.Normalize(season)}", async entry =>
        {
            try
            {
                using var response = await http.GetAsync($"{Api}/leagues?id={leagueId}" + (season is null ? "" : $"&season={Uri.EscapeDataString(SportsSeasons.Normalize(season)!)}"), cancellationToken);
                response.EnsureSuccessStatusCode();
                var league = ParseLeague(await response.Content.ReadAsStringAsync(cancellationToken));
                entry.AbsoluteExpirationRelativeToNow = LeagueCache;
                return league;
            }
            catch (Exception exception) when (exception is HttpRequestException or JsonException or InvalidOperationException or TaskCanceledException && !cancellationToken.IsCancellationRequested)
            {
                System.Diagnostics.Trace.TraceWarning("Data source request failed: {0}", exception.GetType().Name);
                entry.AbsoluteExpirationRelativeToNow = FailureCache;
                return null;
            }
        });

    private static string Crest(string id) => $"https://images.fotmob.com/image_resources/logo/teamlogo/{id}_xsmall.png";

    /// <summary>A slot of the tree whose tie is not played yet ("Sparta Prague/Union St.Gilloise") has a negative id: no crest, no team page.</summary>
    private static bool RealTeam(string? id) => id is not null && !id.StartsWith('-');

    public static FotMobLeague ParseLeague(string json)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        var season = root.TryGetProperty("details", out var details) ? Text(details, "selectedSeason") : null;
        var table = LeagueTable(root);

        var rounds = new List<SportsRound>();
        var playoff = root.TryGetProperty("playoff", out var tree) && tree.ValueKind == JsonValueKind.Object ? tree : default;
        var stages = new HashSet<string>(StringComparer.Ordinal);
        var treeTeams = new HashSet<string>(StringComparer.Ordinal);
        if (playoff.ValueKind == JsonValueKind.Object && playoff.TryGetProperty("rounds", out var list) && list.ValueKind == JsonValueKind.Array)
        {
            foreach (var round in list.EnumerateArray())
            {
                var stage = Text(round, "stage");
                if (stage is null || !round.TryGetProperty("matchups", out var matchups) || matchups.ValueKind != JsonValueKind.Array) continue;
                foreach (var item in matchups.EnumerateArray()) treeTeams.UnionWith(new[] { Text(item, "homeTeamId"), Text(item, "awayTeamId") }.OfType<string>());
                var ordered = matchups.EnumerateArray()
                    .Select(item => (Item: item, Order: Number(item, "drawOrder") is { } order and >= 0 ? order : double.MaxValue))
                    .OrderBy(item => item.Order)
                    .Select(item => Matchup(item.Item))
                    .OfType<SportsMatchup>()
                    .ToArray();
                if (ordered.Length == 0) continue;
                rounds.Add(new SportsRound(stage, ordered));
                stages.Add(stage);
            }
        }

        // A cup without a table: its early rounds (drawn one by one) are only in the fixtures; FotMob's tree starts later.
        // Only FotMob's tree is drawn as a tree; the early rounds of a cup are drawn afresh each time.
        var hasDrawOrder = playoff.ValueKind == JsonValueKind.Object && playoff.TryGetProperty("hasDrawOrder", out var drawOrder) && drawOrder.ValueKind == JsonValueKind.True;
        for (var index = 0; index + 1 < rounds.Count; index++)
        {
            if (Feeds(rounds[index], rounds[index + 1], hasDrawOrder)) rounds[index] = rounds[index] with { FeedsNext = true };
        }

        if (table is null) rounds.InsertRange(0, FixtureRounds(root, stages, treeTeams));

        if (playoff.ValueKind == JsonValueKind.Object && playoff.TryGetProperty("bronzeFinal", out var bronze) && bronze.ValueKind == JsonValueKind.Object && Matchup(bronze) is { } third)
        {
            rounds.Add(new SportsRound("bronze", [third]));
        }

        var name = root.TryGetProperty("details", out details) ? Text(details, "name") : null;
        return new FotMobLeague(season, table, rounds.Count > 0 ? new SportsBracket(rounds) : null, LeagueFixtures(root, name), SportsSeasons.FotMob(root));
    }

    /// <summary>
    /// The ties of the next round are fed in pairs by the ties of this round when the next round has half as many and every
    /// team known there played in one of its two feeding ties. A next round without known teams is taken as fed when FotMob
    /// orders its tree by the draw.
    /// </summary>
    private static bool Feeds(SportsRound round, SportsRound next, bool drawn)
    {
        if (next.Matchups.Count * 2 != round.Matchups.Count) return false;
        var known = false;
        for (var index = 0; index < next.Matchups.Count; index++)
        {
            var feeding = round.Matchups.Skip(index * 2).Take(2).SelectMany(tie => new[] { tie.Home?.Name, tie.Away?.Name }).OfType<string>().ToHashSet(StringComparer.Ordinal);
            foreach (var name in new[] { next.Matchups[index].Home?.Name, next.Matchups[index].Away?.Name }.OfType<string>())
            {
                known = true;
                if (!feeding.Contains(name)) return false;
            }
        }

        return known || drawn;
    }

    private static SportsMatchup? Matchup(JsonElement item)
    {
        var homeId = Text(item, "homeTeamId");
        var awayId = Text(item, "awayTeamId");
        var winnerId = Text(item, "aggregatedWinner") ?? Text(item, "winner");
        SportsBracketTeam? Team(string? id, string nameProperty, string tbdProperty) =>
            id is null || item.TryGetProperty(tbdProperty, out var tbd) && tbd.ValueKind == JsonValueKind.True || Text(item, nameProperty) is not { Length: > 0 } name
                ? null
                : new SportsBracketTeam(name.Trim(), RealTeam(id) ? Crest(id) : null, winnerId is not null && winnerId == id, RealTeam(id) ? id : null);
        var home = Team(homeId, "homeTeam", "tbdTeam1");
        var away = Team(awayId, "awayTeam", "tbdTeam2");

        var games = new List<SportsBracketGame>();
        if (item.TryGetProperty("matches", out var matches) && matches.ValueKind == JsonValueKind.Array)
        {
            foreach (var match in matches.EnumerateArray())
            {
                match.TryGetProperty("home", out var legHome);
                match.TryGetProperty("away", out var legAway);
                var legHomeId = Text(legHome, "id");
                var swapped = legHomeId is not null && homeId is not null && legHomeId != homeId;
                if (Game(match, Whole(swapped ? legAway : legHome, "score"), Whole(swapped ? legHome : legAway, "score")) is { } game) games.Add(game);
            }
        }

        if (home is null && away is null && games.Count == 0) return null;
        var started = games.Any(game => game.Status is "live" or "finished");
        var total = item.TryGetProperty("aggregatedResult", out var aggregate) && aggregate.ValueKind == JsonValueKind.Object ? aggregate : item;
        return new SportsMatchup(home, away, started ? Whole(total, "homeScore") : null, started ? Whole(total, "awayScore") : null, games);
    }

    private static SportsBracketGame? Game(JsonElement match, int? homeScore, int? awayScore)
    {
        if (!match.TryGetProperty("status", out var status) || status.ValueKind != JsonValueKind.Object) return null;
        if (!DateTimeOffset.TryParse(Text(status, "utcTime"), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var start)) return null;
        var state = Flag(status, "cancelled") ? "canceled"
            : Flag(status, "finished") || Flag(status, "awarded") ? "finished"
            : Flag(status, "started") ? "live"
            : "scheduled";
        var reason = status.TryGetProperty("reason", out var why) ? Text(why, "shortKey") ?? Text(why, "short") : null;
        var note = reason switch
        {
            "penalties_short" or "Pen" => "pen",
            "afterextratime_short" or "AET" => "aet",
            _ => null,
        };
        var scored = state is "live" or "finished";
        return new SportsBracketGame(start, state, scored ? homeScore : null, scored ? awayScore : null, note);
    }

    /// <summary>
    /// The rounds of the fixtures that FotMob's tree does not cover, one game per tie, in the order they were played. A tie
    /// decided on penalties has no winner in the fixtures: the team that turns up in a later round won it.
    /// </summary>
    private static IReadOnlyList<SportsRound> FixtureRounds(JsonElement root, HashSet<string> treeStages, HashSet<string> treeTeams)
    {
        if (!root.TryGetProperty("fixtures", out var fixtures) || !fixtures.TryGetProperty("allMatches", out var all) || all.ValueKind != JsonValueKind.Array) return [];

        var byRound = new List<(string Stage, List<JsonElement> Matches)>();
        foreach (var match in all.EnumerateArray())
        {
            var stage = Text(match, "round");
            if (stage is null || treeStages.Contains(stage)) continue;
            var group = byRound.FirstOrDefault(item => item.Stage == stage);
            if (group.Matches is null) byRound.Add(group = (stage, []));
            group.Matches.Add(match);
        }

        // team ids, because the fixtures and the tree write the names differently ("Dortmund", "Borussia Dortmund")
        var laterTeams = new HashSet<string>(treeTeams, StringComparer.Ordinal);
        var rounds = new List<SportsRound>();
        // the latest round first, so that each round knows the teams of the rounds after it
        foreach (var (stage, matches) in byRound.OrderByDescending(item => item.Matches.Min(StartOf)))
        {
            var ties = matches.OrderBy(StartOf).Select(match => FixtureTie(match, laterTeams)).OfType<SportsMatchup>().ToArray();
            foreach (var match in matches)
            {
                laterTeams.UnionWith(new[] { match.TryGetProperty("home", out var home) ? Text(home, "id") : null, match.TryGetProperty("away", out var away) ? Text(away, "id") : null }.OfType<string>());
            }

            if (ties.Length > 0) rounds.Insert(0, new SportsRound(stage, ties));
        }

        return rounds;
    }

    private static DateTimeOffset StartOf(JsonElement match) =>
        match.TryGetProperty("status", out var status) && DateTimeOffset.TryParse(Text(status, "utcTime"), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var start) ? start : DateTimeOffset.MaxValue;

    private static SportsMatchup? FixtureTie(JsonElement match, HashSet<string> laterTeams)
    {
        var homeName = match.TryGetProperty("home", out var home) ? Text(home, "name") : null;
        var awayName = match.TryGetProperty("away", out var away) ? Text(away, "name") : null;
        if (homeName is null || awayName is null || !match.TryGetProperty("status", out var status)) return null;
        var homeId = Text(home, "id");
        var awayId = Text(away, "id");

        int? homeScore = null, awayScore = null;
        var parts = (Text(status, "scoreStr") ?? string.Empty).Split('-', StringSplitOptions.TrimEntries);
        if (parts.Length == 2 && int.TryParse(parts[0], out var left) && int.TryParse(parts[1], out var right)) (homeScore, awayScore) = (left, right);
        if (Game(match, homeScore, awayScore) is not { } game) return null;

        var finished = game.Status == "finished" && game.HomeScore is not null && game.AwayScore is not null;
        var homeWon = finished && (game.HomeScore > game.AwayScore || game.HomeScore == game.AwayScore && homeId is not null && laterTeams.Contains(homeId));
        var awayWon = finished && (game.AwayScore > game.HomeScore || game.HomeScore == game.AwayScore && awayId is not null && laterTeams.Contains(awayId));
        return new SportsMatchup(
            new SportsBracketTeam(homeName.Trim(), RealTeam(homeId) ? Crest(homeId!) : null, homeWon, RealTeam(homeId) ? homeId : null),
            new SportsBracketTeam(awayName.Trim(), RealTeam(awayId) ? Crest(awayId!) : null, awayWon, RealTeam(awayId) ? awayId : null),
            game.HomeScore,
            game.AwayScore,
            [game]);
    }

    /// <summary>The table of the league page: one group, or the groups of a tournament ("Grp. A"); null for a cup.</summary>
    private static SportsTable? LeagueTable(JsonElement root)
    {
        if (!root.TryGetProperty("table", out var tables) || tables.ValueKind != JsonValueKind.Array || tables.GetArrayLength() == 0) return null;
        if (!tables[0].TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Object) return null;

        var parts = data.TryGetProperty("tables", out var composite) && composite.ValueKind == JsonValueKind.Array ? composite.EnumerateArray().ToArray() : [data];
        var zones = new List<SportsZone>();
        var groups = new List<SportsTableGroup>();
        foreach (var part in parts)
        {
            var groupZones = new List<(SportsZone Zone, HashSet<int>? Ranks)>();
            if (part.TryGetProperty("legend", out var legend) && legend.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in legend.EnumerateArray())
                {
                    if (Text(item, "color") is not { } color || !SportsService.ColorPattern().IsMatch(color) || Text(item, "title") is not { } title) continue;
                    var key = Text(item, "tKey");
                    var zone = new SportsZone(color.ToUpperInvariant(), new SportsText(key, title), "fotmob:" + (key ?? title).Trim().ToLowerInvariant());
                    if (!zones.Contains(zone)) zones.Add(zone);
                    HashSet<int>? ranks = null;
                    if (item.TryGetProperty("indices", out var indices) && indices.ValueKind == JsonValueKind.Array)
                        ranks = indices.EnumerateArray().Where(index => index.ValueKind == JsonValueKind.Number && index.TryGetInt32(out var rank) && rank >= 0)
                            .Select(index => index.GetInt32() + 1).ToHashSet();
                    groupZones.Add((zone, ranks));
                }
            }

            if (!part.TryGetProperty("table", out var table) || !table.TryGetProperty("all", out var rows) || rows.ValueKind != JsonValueKind.Array) continue;
            var lines = rows.EnumerateArray().Select(TableRow).OfType<SportsTableRow>().OrderBy(row => row.Rank).Select(row =>
            {
                // Legend indices describe places, whereas colours are presentation and can be shared by different zones.
                var matches = groupZones.Where(item => item.Ranks?.Contains(row.Rank) == true).Select(item => item.Zone).ToArray();
                if (matches.Length == 0)
                    matches = groupZones.Where(item => item.Ranks is null && item.Zone.Color == row.Zone).Select(item => item.Zone).ToArray();
                if (matches.Length == 1) return row with { Zone = matches[0].Color, ZoneKey = matches[0].Key };
                // Do not turn an ambiguous provider colour into a wrong qualification category.
                return groupZones.Any(item => item.Zone.Color == row.Zone) ? row with { Zone = null, ZoneKey = null } : row;
            }).ToArray();
            if (lines.Length > 0) groups.Add(new SportsTableGroup(parts.Length > 1 ? Text(part, "leagueName") : null, lines));
        }

        return groups.Count == 0 ? null : new SportsTable(TableColumns, groups, zones, "fotmob");
    }

    private static SportsTableRow? TableRow(JsonElement row)
    {
        var name = Text(row, "name");
        var id = Text(row, "id");
        if (string.IsNullOrWhiteSpace(name) || id is null) return null;
        var difference = Whole(row, "goalConDiff");
        string Count(string property) => Whole(row, property)?.ToString(CultureInfo.InvariantCulture) ?? "–";
        var color = Text(row, "qualColor");
        return new SportsTableRow(
            Whole(row, "idx") ?? 0,
            name.Trim(),
            Crest(id),
            [
                Count("played"), Count("wins"), Count("draws"), Count("losses"),
                (Text(row, "scoresStr") ?? "–").Replace('-', ':'),
                difference is null ? "–" : difference > 0 ? $"+{difference}" : difference.Value.ToString(CultureInfo.InvariantCulture),
                Count("pts"),
            ],
            color is not null && SportsService.ColorPattern().IsMatch(color) ? color.ToUpperInvariant() : null,
            TeamId: id);
    }

    private static bool Flag(JsonElement element, string property) => element.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.True;

    // ---------- Marking the match of the side panel ----------

    /// <summary>The tie with a game at the kick-off of the match whose teams fit its names (the same rules as for the line-ups).</summary>
    public static SportsBracket MarkMatch(SportsBracket bracket, DateTimeOffset start, string home, string away)
    {
        var games = new List<ListedMatch>();
        for (var round = 0; round < bracket.Rounds.Count; round++)
        {
            for (var tie = 0; tie < bracket.Rounds[round].Matchups.Count; tie++)
            {
                var matchup = bracket.Rounds[round].Matchups[tie];
                // the second leg is played the other way round: both names on both sides, the kick-off tells the legs apart
                var names = new[] { matchup.Home?.Name, matchup.Away?.Name }.OfType<string>().ToArray();
                games.AddRange(matchup.Games.Select(game => new ListedMatch($"{round}:{tie}", game.Start, names, names)));
            }
        }

        if (FindMatch(games, start, home, away) is not { } found) return bracket;
        var (foundRound, foundTie) = (int.Parse(found.Split(':')[0], CultureInfo.InvariantCulture), int.Parse(found.Split(':')[1], CultureInfo.InvariantCulture));
        return bracket with
        {
            Rounds = bracket.Rounds.Select((round, index) => index != foundRound ? round : round with
            {
                Matchups = round.Matchups.Select((tie, position) => position == foundTie ? tie with { Highlight = true } : tie).ToArray(),
            }).ToArray(),
        };
    }

    /// <summary>A test for the rows of a FotMob table: the one row whose name has words of the home (or away) team's name.</summary>
    public static Func<SportsTableRow, bool> NameMatcher(IReadOnlyList<string> names, string home, string away)
    {
        var chosen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var team in new[] { home, away })
        {
            var words = Words(team);
            var fitting = names.Where(name => Words(name).Overlaps(words)).Distinct(StringComparer.Ordinal).ToArray();
            if (fitting.Length == 1) chosen.Add(fitting[0]);
        }

        return row => chosen.Contains(row.Name);
    }
}
