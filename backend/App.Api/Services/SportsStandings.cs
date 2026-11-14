using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Caching.Memory;

namespace Standalone.Api.Services;

/// <summary>
/// A line of a table. <c>Values</c> follow the <c>Columns</c> of the table; <c>Zone</c> is the colour of the zone the place is in
/// (Champions League, relegation, ...), explained by the table's <c>Zones</c>. <c>Highlight</c> marks the teams of the match the
/// table was asked for. In a live table (football) <c>Live</c> is the running match of the team and <c>RankChange</c> how many
/// places it has gained (positive) or lost (negative) against the table before the running matches. <c>TeamId</c> is FotMob's id
/// for the team page (football; null when the team could not be told apart). <c>Form</c> holds the team's last finished matches of
/// the competition (newest first) and <c>Next</c> its next one, both from FotMob's fixtures (football with a FotMob league only).
/// </summary>
public sealed record SportsTableRow(int Rank, string Name, string? Logo, IReadOnlyList<string> Values, string? Zone = null, bool Highlight = false, SportsLiveResult? Live = null, int RankChange = 0, string? TeamId = null, IReadOnlyList<SportsTeamFixture>? Form = null, SportsTeamFixture? Next = null, string? ZoneKey = null);

/// <summary>The running match of a team in a live table: the score seen from the team ("2:1"), <c>win</c>/<c>draw</c>/<c>loss</c> and the minute.</summary>
public sealed record SportsLiveResult(string Score, string Outcome, string Minute);

/// <summary>A table of a league, a conference or a group; <c>Name</c> is null when the competition has only one table.</summary>
public sealed record SportsTableGroup(string? Name, IReadOnlyList<SportsTableRow> Rows);

/// <summary>What a colour of the table means; <c>Label.Key</c> is FotMob's key, ESPN only sends the English text.</summary>
public sealed record SportsZone(string Color, SportsText Label, string? Key = null);

/// <summary>
/// The tables of a competition. <c>Columns</c> are keys the browser translates: <c>gamesPlayed</c>, <c>wins</c>, <c>ties</c>,
/// <c>losses</c>, <c>goals</c>, <c>goalDifference</c>, <c>points</c>, <c>winPercent</c>, <c>gamesBehind</c>, <c>otLosses</c>.
/// <c>Source</c> is <c>espn</c> or <c>fotmob</c>. <c>Live</c>: the running matches are counted in (a live table).
/// </summary>
public sealed record SportsTable(IReadOnlyList<string> Columns, IReadOnlyList<SportsTableGroup> Groups, IReadOnlyList<SportsZone> Zones, string Source, bool Live = false);

/// <summary>One side of a knock-out tie; <c>Logo</c> is FotMob's crest, <c>TeamId</c> FotMob's id for the team page.</summary>
public sealed record SportsBracketTeam(string Name, string? Logo, bool Winner, string? TeamId = null);

/// <summary>
/// One game of a tie, its score seen from the tie's first team. <c>Status</c> is <c>scheduled</c>, <c>live</c>, <c>finished</c> or
/// <c>canceled</c>; <c>Note</c> is <c>aet</c> (after extra time) or <c>pen</c> (after penalties).
/// </summary>
public sealed record SportsBracketGame(DateTimeOffset Start, string Status, int? HomeScore, int? AwayScore, string? Note);

/// <summary>A tie of a knock-out round: one game or two legs, the scores are the totals. A side is null until the draw or the round before decides it.</summary>
public sealed record SportsMatchup(SportsBracketTeam? Home, SportsBracketTeam? Away, int? HomeScore, int? AwayScore, IReadOnlyList<SportsBracketGame> Games, bool Highlight = false);

/// <summary>
/// A round of the knock-out stage. <c>Stage</c> is FotMob's code: <c>playoff</c>, <c>1/16</c>, <c>1/8</c>, <c>1/4</c>, <c>1/2</c>,
/// <c>final</c>, <c>bronze</c> or the number of an early cup round. <c>FeedsNext</c>: the ties of the next round are fed by the ties
/// of this one in pairs (ties 1 and 2 give tie 1 of the next round, ...), so the browser can draw the tree.
/// </summary>
public sealed record SportsRound(string Stage, IReadOnlyList<SportsMatchup> Matchups, bool FeedsNext = false);

public sealed record SportsBracket(IReadOnlyList<SportsRound> Rounds);

/// <summary>The table and the knock-out tree of a competition, each null when the competition has none (or the source has none yet).</summary>
public sealed record SportsStandings(string Competition, string? Season, SportsTable? Table, SportsBracket? Bracket, IReadOnlyList<string>? Seasons = null);

/// <summary>The tables (ESPN's standings) and the knock-out trees (FotMob) of the competitions of the live scores.</summary>
public sealed partial class SportsService
{
    private static readonly TimeSpan StandingsCache = TimeSpan.FromMinutes(5);

    private static readonly string[] SoccerColumns = ["gamesPlayed", "wins", "ties", "losses", "goals", "goalDifference", "points"];

    /// <summary>FotMob's league ids of the football competitions of the catalog: FotMob has the knock-out trees ESPN lacks.</summary>
    private static readonly Dictionary<string, int> FotMobLeagues = new(StringComparer.Ordinal)
    {
        ["soccer/ger.1"] = 54, ["soccer/ger.2"] = 146, ["soccer/eng.1"] = 47, ["soccer/fra.1"] = 53, ["soccer/ita.1"] = 55,
        ["soccer/ksa.1"] = 536, ["soccer/esp.1"] = 87, ["soccer/tur.1"] = 71, ["soccer/eng.2"] = 48, ["soccer/ned.1"] = 57,
        ["soccer/por.1"] = 61, ["soccer/bel.1"] = 40, ["soccer/aut.1"] = 38, ["soccer/sui.1"] = 69, ["soccer/sco.1"] = 64,
        ["soccer/usa.1"] = 130, ["soccer/mex.1"] = 230, ["soccer/bra.1"] = 268, ["soccer/arg.1"] = 112,
        ["soccer/ger.dfb_pokal"] = 209, ["soccer/eng.fa"] = 132, ["soccer/esp.copa_del_rey"] = 138, ["soccer/ita.coppa_italia"] = 141,
        ["soccer/eng.league_cup"] = 133, ["soccer/fra.coupe_de_france"] = 134, ["soccer/ger.super_cup"] = 8924,
        ["soccer/uefa.champions"] = 42, ["soccer/uefa.europa"] = 73, ["soccer/uefa.europa.conf"] = 10216, ["soccer/uefa.super_cup"] = 74,
        ["soccer/fifa.cwc"] = 78, ["soccer/conmebol.libertadores"] = 45, ["soccer/conmebol.sudamericana"] = 299, ["soccer/concacaf.champions"] = 297,
        ["soccer/fifa.world"] = 77, ["soccer/uefa.euro"] = 50, ["soccer/uefa.nations"] = 9806, ["soccer/fifa.worldq.uefa"] = 10195,
        ["soccer/uefa.euroq"] = 10607, ["soccer/fifa.worldq.conmebol"] = 10199, ["soccer/conmebol.america"] = 44, ["soccer/caf.nations"] = 289,
        ["soccer/concacaf.gold"] = 298, ["soccer/concacaf.nations.league"] = 9821,
    };

    /// <summary>Fight cards have no table, friendlies neither table nor tree.</summary>
    public static bool HasStandings(string competition) => !competition.StartsWith("mma/", StringComparison.Ordinal) && competition != "soccer/fifa.friendly";

    /// <summary>
    /// The table (ESPN; FotMob's when ESPN has none) and the knock-out tree (FotMob, football only) of a competition. With the id
    /// of a match of the competition, its two teams and its tie are marked. Null when a source did not answer and nothing is left
    /// to show; a competition that simply has neither gives empty standings.
    /// </summary>
    public async Task<SportsStandings?> GetStandingsAsync(string competition, string? matchId, CancellationToken cancellationToken, string? requestedSeason = null)
    {
        requestedSeason = SportsSeasons.Normalize(requestedSeason);
        var currentTask = GetEspnTableAsync(competition, cancellationToken);
        var fotMobTask = fotMob is not null && FotMobLeagues.TryGetValue(competition, out var leagueId)
            ? fotMob.GetLeagueAsync(leagueId, cancellationToken, requestedSeason) : null;
        var catalogTask = transfermarkt?.GetArchiveCatalogAsync(competition, cancellationToken);
        var current = await currentTask;
        var league = fotMobTask is null ? null : await fotMobTask;
        var catalog = catalogTask is null ? null : await catalogTask;
        var seasons = SportsSeasons.Combine(current?.Seasons?.Select(item => item.Season) ?? [], league?.Seasons ?? [],
            catalog?.Seasons.Select(item => item.Name) ?? [], [current?.Season, league?.Season]);
        var currentSeason = SportsSeasons.Normalize(current?.Season) ?? league?.Seasons?.FirstOrDefault();
        var isCurrent = requestedSeason is null || requestedSeason == currentSeason;
        var year = current?.Seasons?.FirstOrDefault(item => item.Season == requestedSeason)?.Year;
        var espn = requestedSeason is null || SportsSeasons.Normalize(current?.Season) == requestedSeason
            ? current : year is { } selectedYear ? await GetEspnTableAsync(competition, cancellationToken, selectedYear) : null;
        // Some upstreams silently return the current season for unknown historical requests.
        if (requestedSeason is not null && SportsSeasons.Normalize(espn?.Season) != requestedSeason) espn = null;
        if (requestedSeason is not null && SportsSeasons.Normalize(league?.Season) != requestedSeason && league is not null)
            league = league with { Table = null, Bracket = null, Fixtures = null };

        var table = espn?.Table ?? league?.Table;
        var bracket = league?.Bracket;
        var season = espn?.Table is not null ? espn.Season : league?.Table is not null || bracket is not null ? league?.Season : requestedSeason ?? current?.Season;
        if (table is null && requestedSeason is not null && catalog?.Seasons.Any(item => item.Name == requestedSeason) == true)
        {
            table = await transfermarkt!.GetArchiveTableAsync(competition, requestedSeason, cancellationToken);
            if (table is null && bracket is null) return null;
            season = requestedSeason;
        }
        if (table is null && bracket is null)
        {
            if (current is null && league is null) return null;
            if (requestedSeason is null && fotMobTask is not null && league is null) return null;
            return new SportsStandings(competition, season, null, null, seasons);
        }

        if (table is not null && espn?.Table is not null && league?.Table is not null
            && SportsSeasons.Normalize(espn.Season) == SportsSeasons.Normalize(league.Season))
        {
            table = AttachTeamIds(table, league.Table);
            table = AttachQualificationZones(table, espn.Season, league.Table, league.Season);
        }
        if (table is not null && SportsSeasons.Normalize(season) == SportsSeasons.Normalize(league?.Season)
            && league?.Fixtures is { Count: > 0 } fixtures) table = AttachForm(table, fixtures);
        // Historical tables retain their original points and never receive today's running results.
        if (isCurrent && table is not null && competition.StartsWith("soccer/", StringComparison.Ordinal) && table.Columns.SequenceEqual(SoccerColumns))
        {
            var live = await GetLiveMatchesAsync(competition, cancellationToken);
            if (live.Count > 0) table = ApplyLive(table, live);
        }

        var match = isCurrent && matchId is not null && IsTeamSport(competition) ? await GetMatchAsync(competition, matchId, cancellationToken) : null;
        if (match is not null)
        {
            table = table is null ? null : MarkTeams(table, match.Home.Name, match.Away.Name);
            bracket = bracket is null ? null : FotMobService.MarkMatch(bracket, match.Start, match.Home.Name, match.Away.Name);
        }
        return new SportsStandings(competition, season, table, bracket, seasons);
    }

    /// <summary>What ESPN's standings give: the season ("2026-27") and the tables, null when the competition has none.</summary>
    public sealed record EspnSeason(string Season, int Year);
    public sealed record EspnTable(string? Season, SportsTable? Table, IReadOnlyList<EspnSeason>? Seasons = null);

    private async Task<EspnTable?> GetEspnTableAsync(string competition, CancellationToken cancellationToken, int? year = null) =>
        await cache.GetOrCreateAsync($"sports:standings:{competition}:{year}", async entry =>
        {
            try
            {
                using var response = await http.GetAsync($"https://site.api.espn.com/apis/v2/sports/{competition}/standings" + (year is null ? "" : $"?season={year}"), cancellationToken);
                response.EnsureSuccessStatusCode();
                var parsed = ParseStandings(competition, await response.Content.ReadAsStringAsync(cancellationToken));
                entry.AbsoluteExpirationRelativeToNow = year is not null && year < DateTime.UtcNow.Year - 1 ? TimeSpan.FromHours(24) : StandingsCache;
                return parsed;
            }
            catch (Exception exception) when (exception is HttpRequestException or JsonException or InvalidOperationException or TaskCanceledException && !cancellationToken.IsCancellationRequested)
            {
                System.Diagnostics.Trace.TraceWarning("Data source request failed: {0}", exception.GetType().Name);
                entry.AbsoluteExpirationRelativeToNow = FailureCache;
                return null;
            }
        });

    /// <summary>
    /// The running matches of a competition: ESPN files a match under the day of its kick-off in US time, so a late match of the
    /// evening can be on the day before by UTC. Both scoreboards are cached like the live scores (30 s while a match runs).
    /// </summary>
    private async Task<IReadOnlyList<SportsMatch>> GetLiveMatchesAsync(string competition, CancellationToken cancellationToken)
    {
        var today = DateTime.UtcNow.Date;
        var days = await Task.WhenAll(new[] { today, today.AddDays(-1) }.Select(day => GetCompetitionAsync(competition, day.ToString("yyyyMMdd", CultureInfo.InvariantCulture), cancellationToken)));
        return days.Where(day => day is not null)
            .SelectMany(day => day!.Matches)
            .Where(match => match.Status == "live" && match.Home is not null && match.Away is not null)
            .DistinctBy(match => match.Id)
            .ToArray();
    }

    /// <summary>
    /// The live table: each running match is counted as if it ended now (played, won/drawn/lost, goals, points) for both teams
    /// when they are in the same group, then every group is sorted again by points, goal difference and goals scored (the
    /// competition's own tie-breakers such as the head-to-head are not known; equal teams keep the order of the table). The
    /// colours of the zones belong to the places, not the teams; <c>RankChange</c> compares with the table before.
    /// </summary>
    public static SportsTable ApplyLive(SportsTable table, IReadOnlyList<SportsMatch> live)
    {
        var columns = table.Columns.ToList();
        int Column(string key) => columns.IndexOf(key);
        if (new[] { "gamesPlayed", "wins", "ties", "losses", "goals", "goalDifference", "points" }.Any(key => Column(key) < 0)) return table;

        var counted = false;
        var groups = table.Groups.Select(group =>
        {
            var names = group.Rows.Select(row => row.Name).ToArray();
            var rows = group.Rows.ToList();
            var changed = false;
            foreach (var match in live)
            {
                if (match.Status != "live" || match.Home is null || match.Away is null) continue;
                if (!int.TryParse(match.Home.Score, out var homeGoals) || !int.TryParse(match.Away.Score, out var awayGoals)) continue;
                var homeIndex = FindRow(names, match.Home.Name, table.Source);
                var awayIndex = FindRow(names, match.Away.Name, table.Source);
                if (homeIndex < 0 || awayIndex < 0 || homeIndex == awayIndex) continue;
                rows[homeIndex] = Count(rows[homeIndex], homeGoals, awayGoals, match.StatusText);
                rows[awayIndex] = Count(rows[awayIndex], awayGoals, homeGoals, match.StatusText);
                changed = true;
            }

            if (!changed) return group;
            counted = true;
            var zones = group.Rows.Select(row => (row.Zone, row.ZoneKey)).ToArray();
            var sorted = rows
                .Select((row, index) => (Row: row, Before: index))
                .OrderByDescending(item => Number(item.Row, "points"))
                .ThenByDescending(item => Number(item.Row, "goalDifference"))
                .ThenByDescending(item => GoalsFor(item.Row))
                .ThenBy(item => item.Before)
                .Select((item, index) => item.Row with { Rank = index + 1, Zone = zones[index].Zone, ZoneKey = zones[index].ZoneKey, RankChange = item.Before - index })
                .ToArray();
            return group with { Rows = sorted };
        }).ToArray();

        return counted ? table with { Groups = groups, Live = true } : table;

        SportsTableRow Count(SportsTableRow row, int scored, int conceded, string minute)
        {
            var values = row.Values.ToArray();
            void Add(string key, int value) => values[Column(key)] = (ParseInt(values[Column(key)]) + value).ToString(CultureInfo.InvariantCulture);
            var outcome = scored > conceded ? "win" : scored == conceded ? "draw" : "loss";
            Add("gamesPlayed", 1);
            Add(outcome switch { "win" => "wins", "draw" => "ties", _ => "losses" }, 1);
            Add("points", outcome switch { "win" => 3, "draw" => 1, _ => 0 });
            var goals = values[Column("goals")].Split(':');
            var goalsFor = ParseInt(goals.ElementAtOrDefault(0)) + scored;
            var goalsAgainst = ParseInt(goals.ElementAtOrDefault(1)) + conceded;
            values[Column("goals")] = $"{goalsFor}:{goalsAgainst}";
            var difference = goalsFor - goalsAgainst;
            values[Column("goalDifference")] = difference > 0 ? $"+{difference}" : difference.ToString(CultureInfo.InvariantCulture);
            return row with { Values = values, Live = new SportsLiveResult($"{scored}:{conceded}", outcome, minute) };
        }

        int Number(SportsTableRow row, string key) => ParseInt(row.Values[Column(key)]);
        int GoalsFor(SportsTableRow row) => ParseInt(row.Values[Column("goals")].Split(':')[0]);
    }

    /// <summary>
    /// FotMob's team ids on the rows of ESPN's table: each row takes the FotMob row whose name shares the most words with it
    /// ("Hamburg" fits "Hamburger"); the same figures count as half a word more, which tells two clubs of one city apart, and
    /// alone they are enough when no other row of either table has them ("Wolves" / "Wolverhampton Wanderers"). A row with
    /// no clear partner, or a partner wanted by two rows, stays without id.
    /// </summary>
    public static SportsTable AttachTeamIds(SportsTable table, SportsTable fotMob)
    {
        var candidates = fotMob.Groups.SelectMany(group => group.Rows).Where(row => row.TeamId is not null).ToArray();
        if (candidates.Length == 0) return table;
        var sameColumns = table.Columns.SequenceEqual(fotMob.Columns);
        var words = candidates.Select(row => FotMobService.Words(row.Name)).ToArray();
        var espnFigures = table.Groups.SelectMany(group => group.Rows).GroupBy(row => string.Join('|', row.Values)).ToDictionary(group => group.Key, group => group.Count());
        var fotMobFigures = candidates.GroupBy(row => string.Join('|', row.Values)).ToDictionary(group => group.Key, group => group.Count());

        static bool SameWord(string left, string right) =>
            left == right || Math.Min(left.Length, right.Length) >= 4 && (left.StartsWith(right, StringComparison.Ordinal) || right.StartsWith(left, StringComparison.Ordinal));

        string? Partner(SportsTableRow row)
        {
            var own = FotMobService.Words(row.Name);
            var figures = string.Join('|', row.Values);
            var unique = espnFigures[figures] == 1 && fotMobFigures.GetValueOrDefault(figures) == 1;
            var scores = candidates.Select((candidate, index) =>
            {
                var shared = own.Count(word => words[index].Any(other => SameWord(word, other)));
                var same = sameColumns && candidate.Values.SequenceEqual(row.Values) && (shared > 0 || unique);
                return shared * 2 + (same ? 1 : 0);
            }).ToArray();
            var best = scores.Max();
            return best > 0 && scores.Count(score => score == best) == 1 ? candidates[Array.IndexOf(scores, best)].TeamId : null;
        }

        var partners = table.Groups.Select(group => group.Rows.Select(Partner).ToArray()).ToArray();
        var wanted = partners.SelectMany(ids => ids).OfType<string>().GroupBy(id => id).Where(group => group.Count() > 1).Select(group => group.Key).ToHashSet(StringComparer.Ordinal);
        return table with
        {
            Groups = table.Groups.Select((group, groupIndex) => group with
            {
                Rows = group.Rows.Select((row, rowIndex) => partners[groupIndex][rowIndex] is { } id && !wanted.Contains(id) ? row with { TeamId = id } : row).ToArray(),
            }).ToArray(),
        };
    }

    /// <summary>
    /// FotMob publishes the current season's qualification positions separately from team results. ESPN can retain older
    /// cup/qualification allocations, so use FotMob's zones when both tables describe the same season and team group.
    /// Match groups by their complete team-id sets, then copy zones by rank, never by the team's current position at the
    /// other provider. Unknown seasons, partial groups and ambiguous matches retain the original source's zones.
    /// </summary>
    public static SportsTable AttachQualificationZones(SportsTable table, string? season, SportsTable fotMob, string? fotMobSeason)
    {
        if (SeasonIdentity(season) is not { } identity || identity != SeasonIdentity(fotMobSeason)) return table;
        if (!table.Columns.SequenceEqual(fotMob.Columns)) return table;

        static HashSet<string>? TeamIds(SportsTableGroup group)
        {
            var ids = group.Rows.Select(row => row.TeamId).OfType<string>().ToHashSet(StringComparer.Ordinal);
            return ids.Count == group.Rows.Count && ids.Count > 0 ? ids : null;
        }

        var replaced = false;
        var groups = table.Groups.Select(group =>
        {
            if (TeamIds(group) is not { } teams) return group;
            var candidates = fotMob.Groups.Where(candidate => TeamIds(candidate) is { } others && teams.SetEquals(others)).ToArray();
            if (candidates.Length != 1) return group;
            var source = candidates[0];
            if (!source.Rows.Any(row => row.ZoneKey is not null)) return group;
            if (source.Rows.Select(row => row.Rank).Distinct().Count() != source.Rows.Count
                || !group.Rows.Select(row => row.Rank).Order().SequenceEqual(source.Rows.Select(row => row.Rank).Order())) return group;
            var positions = source.Rows.ToDictionary(row => row.Rank);
            replaced = true;
            return group with { Rows = group.Rows.Select(row => row with { Zone = positions[row.Rank].Zone, ZoneKey = positions[row.Rank].ZoneKey }).ToArray() };
        }).ToArray();
        return replaced ? table with { Groups = groups, Zones = table.Zones.Concat(fotMob.Zones).Distinct().ToArray() } : table;
    }

    private static string? SeasonIdentity(string? season)
    {
        if (string.IsNullOrWhiteSpace(season)) return null;
        var parts = season.Trim().Replace('/', '-').Split('-');
        if (parts.Length is < 1 or > 2 || parts[0].Length != 4 || !int.TryParse(parts[0], out var start)) return null;
        if (parts.Length == 1) return start.ToString(CultureInfo.InvariantCulture);
        if (!int.TryParse(parts[1], out var end) || parts[1].Length is not (2 or 4)) return null;
        if (parts[1].Length == 2) end += start / 100 * 100 + (end < start % 100 ? 100 : 0);
        return $"{start}/{end}";
    }

    /// <summary>"+12" is 12, "–" (no value) is 0.</summary>
    private static int ParseInt(string? value) =>
        int.TryParse((value ?? string.Empty).Trim().TrimStart('+'), NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture, out var number) ? number : 0;

    /// <summary>A team of a match in a table: by its exact name in ESPN's tables (same source), by the words of the name in FotMob's.</summary>
    private static int FindRow(string[] names, string name, string source)
    {
        var exact = Array.FindIndex(names, row => string.Equals(row, name, StringComparison.OrdinalIgnoreCase));
        if (exact >= 0 || source == "espn") return exact;
        var matcher = FotMobService.NameMatcher(names, name, name);
        var found = names.Select((row, index) => (row, index)).Where(item => matcher(new SportsTableRow(0, item.row, null, []))).ToArray();
        return found.Length == 1 ? found[0].index : -1;
    }

    /// <summary>The teams of the match: by their exact name in ESPN's tables (same source as the match), by the words of the name in FotMob's.</summary>
    public static SportsTable MarkTeams(SportsTable table, string home, string away)
    {
        Func<SportsTableRow, bool> isTeam = table.Source == "espn"
            ? row => string.Equals(row.Name, home, StringComparison.OrdinalIgnoreCase) || string.Equals(row.Name, away, StringComparison.OrdinalIgnoreCase)
            : FotMobService.NameMatcher(table.Groups.SelectMany(group => group.Rows).Select(row => row.Name).ToArray(), home, away);
        return table with
        {
            Groups = table.Groups.Select(group => group with { Rows = group.Rows.Select(row => isTeam(row) ? row with { Highlight = true } : row).ToArray() }).ToArray(),
        };
    }

    // ---------- Parsing ESPN's standings ----------

    /// <summary>ESPN's standings: one group per table (a league, the conferences, the groups of a tournament).</summary>
    public static EspnTable ParseStandings(string competition, string json)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        var seasons = new List<EspnSeason>();
        if (root.TryGetProperty("seasons", out var seasonList) && seasonList.ValueKind == JsonValueKind.Array)
            foreach (var item in seasonList.EnumerateArray())
            {
                var label = SportsSeasons.Normalize(Text(item, "seasonYears") ?? SeasonOf(Text(item, "displayName")));
                if (label is not null && item.TryGetProperty("year", out var yearNode) && yearNode.ValueKind == JsonValueKind.Number
                    && yearNode.TryGetInt32(out var year) && year is >= 1990 and <= 2200)
                    seasons.Add(new EspnSeason(label, year));
            }
        var nodes = new List<JsonElement>();
        CollectStandings(root, nodes);

        var sport = competition.Split('/')[0];
        var columns = ColumnsFor(sport);
        var zones = new List<SportsZone>();
        var groups = new List<SportsTableGroup>();
        // the season of the tables themselves; the root names the coming season once it is set up (MLB in October: 2027)
        string? season = null;
        foreach (var node in nodes)
        {
            var standings = node.GetProperty("standings");
            season ??= SeasonOf(Text(standings, "seasonDisplayName"));
            var rows = new List<(SportsTableRow Row, double Order)>();
            foreach (var entry in standings.GetProperty("entries").EnumerateArray())
            {
                if (StandingsRow(entry, sport, columns, zones) is { } row) rows.Add(row);
            }

            if (rows.Count == 0) continue;
            var ordered = rows.OrderBy(item => item.Order).Select((item, index) => item.Row with { Rank = index + 1 }).ToArray();
            groups.Add(new SportsTableGroup(Text(node, "name") ?? Text(node, "abbreviation"), ordered));
        }

        season ??= root.TryGetProperty("season", out var rootSeason) ? SeasonOf(Text(rootSeason, "displayName")) : null;
        if (groups.Count == 0) return new EspnTable(season, null, seasons);
        // one table needs no name ("2026-27 German Bundesliga")
        if (groups.Count == 1) groups[0] = groups[0] with { Name = null };
        return new EspnTable(season, new SportsTable(columns, groups, zones, "espn"), seasons);
    }

    private static void CollectStandings(JsonElement node, List<JsonElement> nodes)
    {
        if (node.ValueKind != JsonValueKind.Object) return;
        if (node.TryGetProperty("standings", out var standings) && standings.ValueKind == JsonValueKind.Object
            && standings.TryGetProperty("entries", out var entries) && entries.ValueKind == JsonValueKind.Array && entries.GetArrayLength() > 0)
        {
            nodes.Add(node);
        }

        if (node.TryGetProperty("children", out var children) && children.ValueKind == JsonValueKind.Array)
        {
            foreach (var child in children.EnumerateArray()) CollectStandings(child, nodes);
        }
    }

    private static string[] ColumnsFor(string sport) => sport switch
    {
        "soccer" => SoccerColumns,
        "basketball" or "baseball" => ["wins", "losses", "winPercent", "gamesBehind"],
        "football" => ["wins", "losses", "ties", "winPercent"],
        "hockey" => ["gamesPlayed", "wins", "losses", "otLosses", "points"],
        _ => ["points"],
    };

    /// <summary>One line and the number it is sorted by: the place for football and racing, the seed (or the win share) for US sports.</summary>
    private static (SportsTableRow Row, double Order)? StandingsRow(JsonElement entry, string sport, string[] columns, List<SportsZone> zones)
    {
        var who = entry.TryGetProperty("team", out var team) && team.ValueKind == JsonValueKind.Object ? team
            : entry.TryGetProperty("athlete", out var athlete) && athlete.ValueKind == JsonValueKind.Object ? athlete : default;
        var name = who.ValueKind == JsonValueKind.Object ? Text(who, "displayName") ?? Text(who, "name") : null;
        if (string.IsNullOrWhiteSpace(name)) return null;
        var logo = Https(who.TryGetProperty("logos", out var logos) && logos.ValueKind == JsonValueKind.Array && logos.GetArrayLength() > 0
            ? Text(logos[0], "href")
            : who.TryGetProperty("flag", out var flag) ? Text(flag, "href") : null);

        var stats = new Dictionary<string, (string Text, double? Value)>(StringComparer.Ordinal);
        if (entry.TryGetProperty("stats", out var list) && list.ValueKind == JsonValueKind.Array)
        {
            foreach (var stat in list.EnumerateArray())
            {
                var key = Text(stat, "name") ?? Text(stat, "type");
                if (key is null || stats.ContainsKey(key)) continue;
                var value = stat.TryGetProperty("value", out var number) && number.ValueKind == JsonValueKind.Number ? number.GetDouble() : (double?)null;
                stats[key] = ((Text(stat, "displayValue") ?? string.Empty).Trim(), value);
            }
        }

        string Value(string column) => column switch
        {
            "goals" => $"{Stat("pointsFor")}:{Stat("pointsAgainst")}",
            "goalDifference" => Stat("pointDifferential"),
            "points" when sport == "racing" => Stat("championshipPts") is { Length: > 0 } points ? points : Stat("points"),
            _ => Stat(column),
        };
        string Stat(string key) => stats.TryGetValue(key, out var stat) && stat.Text.Length > 0 ? stat.Text : "–";
        double? Number(string key) => stats.TryGetValue(key, out var stat) ? stat.Value ?? (double.TryParse(stat.Text, NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed) ? parsed : null) : null;

        // the seeds first; teams without one after them, by points (ice hockey) or by the share of wins
        double order;
        if (sport is "soccer" or "racing") order = Number("rank") ?? 999;
        else if (Number("playoffSeed") is { } seed && seed > 0) order = seed;
        else order = 1000 - (sport == "hockey" ? Number("points") ?? 0 : (Number("winPercent") ?? 0) * 100);

        string? zone = null, zoneKey = null;
        if (entry.TryGetProperty("note", out var note) && note.ValueKind == JsonValueKind.Object)
        {
            var color = Text(note, "color");
            var description = Text(note, "description");
            zone = color is not null && ColorPattern().IsMatch(color) ? color.ToUpperInvariant() : null;
            if (!string.IsNullOrWhiteSpace(description))
            {
                zone ??= "#64748B";
                zoneKey = "espn:" + description.Trim().ToLowerInvariant();
                if (!zones.Any(item => item.Key == zoneKey)) zones.Add(new SportsZone(zone, new SportsText(null, description), zoneKey));
            }
        }

        return (new SportsTableRow(0, name.Trim(), logo, columns.Select(Value).ToArray(), zone, ZoneKey: zoneKey), order);
    }

    /// <summary>"2026-27 German Bundesliga" is 2026-27, "2026 MLS" is 2026.</summary>
    private static string? SeasonOf(string? text) => text is not null && SeasonPattern().Match(text) is { Success: true } match ? match.Value : null;

    [GeneratedRegex(@"^#[0-9A-Fa-f]{6}$", RegexOptions.CultureInvariant)]
    internal static partial Regex ColorPattern();

    [GeneratedRegex(@"^\d{4}(?:[-/]\d{2,4})?", RegexOptions.CultureInvariant)]
    private static partial Regex SeasonPattern();
}
