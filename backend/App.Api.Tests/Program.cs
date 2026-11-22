using System.Net;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using Standalone.Api.Services;

var failed = 0;
await Run("match details merge coach dismissals from both sources in match order", async () =>
{
    using var cache = new MemoryCache(new MemoryCacheOptions());
    using var http = new HttpClient(new FixtureHandler(uri => uri.AbsolutePath.Split('/').Last() switch
    {
        "summary" => """
            {"header":{"competitions":[{"id":"1","date":"2022-10-16T15:30:00Z","competitors":[
                {"homeAway":"home","team":{"id":"1","displayName":"Liverpool"}},
                {"homeAway":"away","team":{"id":"2","displayName":"Manchester City"}}]}]},
             "keyEvents":[
                {"type":{"type":"red-card"},"team":{"id":"2"},"clock":{"displayValue":"52'"},"participants":[{"athlete":{"displayName":"Away Coach"}}]},
                {"type":{"type":"yellow-card"},"team":{"id":"1"},"clock":{"displayValue":"89'"},"participants":[{"athlete":{"displayName":"Player"}}]}]}
            """,
        "matches" => """
            {"leagues":[{"matches":[{"id":"3901037","status":{"utcTime":"2022-10-16T15:30:00Z"},"home":{"name":"Liverpool"},"away":{"name":"Manchester City"}}]}]}
            """,
        "matchDetails" => """
            {"content":{"matchFacts":{"events":{"events":[
                {"type":"Card","card":"Red","time":52,"isHome":false,"nameStr":"Away Coach","cardDescription":{"localizedKey":"coach"}},
                {"type":"Card","card":"Red","time":86,"isHome":true,"player":{"id":78660,"name":"Jürgen Klopp"},"cardDescription":{"localizedKey":"coach"}},
                {"type":"Card","card":"Red","time":90,"isHome":true,"nameStr":"Unrelated Player"}]}}}}
            """,
        _ => throw new Exception($"Unexpected request {uri}"),
    }));
    var match = await new SportsService(http, cache, new FotMobService(http, cache)).GetMatchAsync("soccer/eng.1", "1", CancellationToken.None);
    var events = match!.Events;
    Equal(3, events.Count);
    Equal("Away Coach", events[0].Player);
    Equal("away", events[0].Side);
    Equal("Jürgen Klopp", events[1].Player);
    Equal("86'", events[1].Minute);
    Equal("home", events[1].Side);
    Equal("red", events[1].Kind);
    Equal("Player", events[2].Player);
    Equal(true, events[0].IsCoach && events[1].IsCoach);
    Equal(false, events[2].IsCoach);
});

await Run("Nations League loads zones and team ids for A, B, C and D", async () =>
{
    var result = await Standings();
    Equal(4, result!.Table!.Groups.Count);
    Equal("fotmob:championship_playoff", result.Table.Groups[0].Rows[0].ZoneKey);
    foreach (var group in result.Table.Groups.Skip(1)) Equal("fotmob:promotion", group.Rows[0].ZoneKey);
    Equal("fotmob:promotionqual", result.Table.Groups[1].Rows[1].ZoneKey);
    Equal("fotmob:promotionqual", result.Table.Groups[2].Rows[1].ZoneKey);
    Equal("fotmob:promotion", result.Table.Groups[3].Rows[1].ZoneKey);
    Equal(true, result.Table.Groups.SelectMany(group => group.Rows).All(row => row.TeamId is not null));
    Equal("espn", result.Table.Source);
});
await Run("Nations League fallback preserves all league group names", async () =>
{
    var result = await Standings(espnFails: true);
    Equal(4, result!.Table!.Groups.Count);
    Equal("League A, Grp. 1", result.Table.Groups[0].Name);
    Equal("League D, Grp. 1", result.Table.Groups[3].Name);
});
await Run("Nations League does not merge zones from a different season", async () =>
{
    var result = await Standings(otherSeason: true);
    Equal(null, result!.Table!.Groups[1].Rows[0].ZoneKey);
    Equal("fotmob:promotion", result.Table.Groups[2].Rows[0].ZoneKey);
});
await Run("one unavailable Nations League source keeps the other leagues usable", async () =>
{
    var result = await Standings(failedLeague: 9807);
    Equal(4, result!.Table!.Groups.Count);
    Equal(null, result.Table.Groups[1].Rows[0].ZoneKey);
    Equal("fotmob:promotion", result.Table.Groups[3].Rows[0].ZoneKey);
});
await Run("all FotMob table blocks retain their own qualification zones", () =>
{
    var table = FotMobService.ParseLeague(JsonSerializer.Serialize(new { table = new object[]
    {
        new { data = Part("Championship", "championship_playoff", "Championship playoff", "#2AD572", "France", "Germany") },
        new { data = Part("Relegation", "relegation", "Relegation", "#FF4646", "Malta", "Andorra") },
    } })).Table!;
    Equal(2, table.Groups.Count);
    Equal("Championship", table.Groups[0].Name);
    Equal("fotmob:relegation", table.Groups[1].Rows[0].ZoneKey);
    Equal(2, table.Zones.Count);
    return Task.CompletedTask;
});
await Run("parent legends label matching markers without marking unrelated overall tables", () =>
{
    var legend = new[] { new { title = "Promotion", tKey = "promotion", color = "#2AD572", indices = new[] { 0 } } };
    var table = FotMobService.ParseLeague(JsonSerializer.Serialize(new { table = new[] { new { data = new
    {
        legend,
        tables = new object[]
        {
            new { leagueName = "Group A", table = new { all = new[] { FmRow("France", 1, "#2AD572") } } },
            new { leagueName = "Overall", table = new { all = new[] { FmRow("Germany", 1, null) } } },
        },
    } } } })).Table!;
    Equal("fotmob:promotion", table.Groups[0].Rows[0].ZoneKey);
    Equal(null, table.Groups[1].Rows[0].ZoneKey);
    return Task.CompletedTask;
});
await Run("repeated source teams in conference and overall tables still get ids and zones", () =>
{
    var source = new SportsTable(["points"],
    [
        new("Conference", [Row("France", "1", "promotion"), Row("Germany", "2", null, 2)]),
        new("Overall", [Row("France", "1", null), Row("Germany", "2", null, 2)]),
    ], [new("#2AD572", new("promotion", "Promotion"), "promotion")], "fotmob");
    var target = source with { Source = "espn", Groups = source.Groups.Select(group => group with
    {
        Rows = group.Rows.Select(row => row with { TeamId = null, Zone = null, ZoneKey = null }).ToArray(),
    }).ToArray() };
    var attached = SportsService.AttachTeamIds(target, source);
    Equal("1", attached.Groups[0].Rows[0].TeamId);
    Equal("1", attached.Groups[1].Rows[0].TeamId);
    // Identical groups are ambiguous, so do not copy a conference rule into the overall table.
    Equal(null, SportsService.AttachQualificationZones(attached, "2026", source, "2026").Groups[1].Rows[0].ZoneKey);
    return Task.CompletedTask;
});
await Run("identical colours never conflate promotion and qualification", () =>
{
    var part = new
    {
        leagueName = "Group B",
        legend = new[]
        {
            new { title = "Promotion", tKey = "promotion", color = "#2AD572", indices = new[] { 0 } },
            new { title = "Promotion qualification", tKey = "promotionqual", color = "#2AD572", indices = new[] { 1 } },
        },
        table = new { all = new[] { FmRow("France", 1, "#2AD572"), FmRow("Germany", 2, "#2AD572") } },
    };
    var table = FotMobService.ParseLeague(JsonSerializer.Serialize(new { table = new[] { new { data = part } } })).Table!;
    Equal("fotmob:promotion", table.Groups[0].Rows[0].ZoneKey);
    Equal("fotmob:promotionqual", table.Groups[0].Rows[1].ZoneKey);
    return Task.CompletedTask;
});
await Run("World Cup qualifying aligns its tournament year with the source cycle", async () =>
{
    var result = await SourceStandings("soccer/fifa.worldq.uefa", "2026", "2025/2026", [
        Part("Group K", "world_cup", "World Cup", "#2AD572", "England", "Albania"),
    ]);
    Equal("fotmob:world_cup", result!.Table!.Groups[0].Rows[0].ZoneKey);
});
await Run("Argentina selects qualification places from the matching phase snapshot", async () =>
{
    var result = await SourceStandings("soccer/arg.1", "2026", "2026 - Clausura", [
        Part("Clausura Group A", "q1of8finals", "Qualification to 1/8 Finals", "#2AD572", "France", "Germany"),
        new { leagueName = "Apertura Group A", legend = Array.Empty<object>(), table = new { all = new[] {
            new { id = "France", name = "France", idx = 1, played = 8, wins = 8, draws = 0, losses = 0, scoresStr = "8-0", goalConDiff = 8, pts = 24 },
            FmRow("Germany", 2, null),
        } } },
    ]);
    Equal("fotmob:q1of8finals", result!.Table!.Groups[0].Rows[0].ZoneKey);
});
await Run("a different qualifying cycle never supplies current qualification places", async () =>
{
    var result = await SourceStandings("soccer/fifa.worldq.uefa", "2026", "2021/2022", [
        Part("Group K", "world_cup", "World Cup", "#2AD572", "England", "Albania"),
    ]);
    Equal(null, result!.Table!.Groups[0].Rows[0].ZoneKey);
});
await Run("partial sources never assign one country's id to a different country in another group", () =>
{
    var source = new SportsTable(["points"], [new("Group C", [Row("Northern Ireland", "123", null)])], [], "fotmob");
    var target = new SportsTable(["points"], [
        new("Group B", [Row("Republic of Ireland", "", null) with { TeamId = null }]),
        new("Group C", [Row("Northern Ireland", "", null) with { TeamId = null }]),
    ], [], "espn");
    var attached = SportsService.AttachTeamIds(target, source);
    Equal(null, attached.Groups[0].Rows[0].TeamId);
    Equal(null, attached.Groups[1].Rows[0].TeamId);
    return Task.CompletedTask;
});
await Run("form matches from Nations League B, C and D open the combined competition", async () =>
{
    foreach (var leagueId in new[] { 9807, 9808, 9809 })
    {
        using var cache = new MemoryCache(new MemoryCacheOptions());
        using var http = new HttpClient(new FixtureHandler(uri =>
        {
            if (uri.AbsolutePath.EndsWith("/matchDetails")) return JsonSerializer.Serialize(new { general = new {
                matchId = "5181812", leagueId = 920747, parentLeagueId = leagueId, matchTimeUTCDate = "2026-09-24T18:45:00Z",
                homeTeam = new { name = "Austria" }, awayTeam = new { name = "Israel" },
            } });
            if (uri.AbsolutePath == "/apis/site/v2/sports/soccer/uefa.nations/scoreboard") return JsonSerializer.Serialize(new { events = new[] { new {
                id = "12345", date = "2026-09-24T18:45:00Z", competitions = new[] { new { competitors = new[] {
                    new { homeAway = "home", team = new { displayName = "Austria" } },
                    new { homeAway = "away", team = new { displayName = "Israel" } },
                } } },
            } } });
            throw new Exception($"Unexpected request {uri}");
        }));
        var link = await new SportsService(http, cache, new FotMobService(http, cache)).FindMatchAsync("5181812", CancellationToken.None);
        Equal("soccer/uefa.nations", link?.Competition);
        Equal("12345", link?.Match.Id);
    }
});
await Run("returning to the explicit current season keeps qualification aliases", async () =>
{
    foreach (var (competition, sourceSeason) in new[] {
        ("soccer/fifa.worldq.uefa", "2025/2026"), ("soccer/arg.1", "2026 - Clausura"),
    })
    {
        var result = await SourceStandings(competition, "2026", sourceSeason, [
            Part("Group A", "world_cup", "World Cup", "#2AD572", "France", "Germany"),
        ], "2026");
        Equal("fotmob:world_cup", result!.Table!.Groups[0].Rows[0].ZoneKey);
    }
});
await Run("a single Argentina phase with different statistics cannot supply yearly table rules", async () =>
{
    var result = await SourceStandings("soccer/arg.1", "2026", "2026 - Clausura", [
        new { leagueName = "Clausura Group A", legend = new[] { new { title = "Promotion", tKey = "promotion", color = "#2AD572", indices = new[] { 0 } } }, table = new { all = new[] {
            new { id = "France", name = "France", idx = 1, played = 8, wins = 8, draws = 0, losses = 0, scoresStr = "8-0", goalConDiff = 8, pts = 24 },
            FmRow("Germany", 2, null),
        } } },
    ]);
    Equal(null, result!.Table!.Groups[0].Rows[0].ZoneKey);
});
await Run("identical qualification rules across possible phases tolerate live snapshot differences", async () =>
{
    var result = await SourceStandings("soccer/arg.1", "2026", "2026 - Clausura", [
        new { leagueName = "Clausura Group A", legend = new[] { new { title = "Qualification to 1/8 Finals", tKey = "q1of8finals", color = "#2AD572", indices = new[] { 0 } } }, table = new { all = new[] {
            new { id = "France", name = "France", idx = 1, played = 8, wins = 8, draws = 0, losses = 0, scoresStr = "8-0", goalConDiff = 8, pts = 24 },
            FmRow("Germany", 2, null),
        } } },
        new { leagueName = "Apertura Group A", legend = new[] { new { title = "Qualification to 1/8 Finals", tKey = "q1of8finals", color = "#2AD572", indices = new[] { 0 } } }, table = new { all = new[] {
            new { id = "France", name = "France", idx = 1, played = 9, wins = 9, draws = 0, losses = 0, scoresStr = "9-0", goalConDiff = 9, pts = 27 },
            FmRow("Germany", 2, null),
        } } },
    ]);
    Equal("fotmob:q1of8finals", result!.Table!.Groups[0].Rows[0].ZoneKey);
});
await PlayoffTests.Run(Run);
Environment.ExitCode = failed > 0 ? 1 : 0;

async Task Run(string name, Func<Task> test)
{
    try { await test(); Console.WriteLine($"PASS {name}"); }
    catch (Exception error) { failed++; Console.Error.WriteLine($"FAIL {name}: {error.Message}"); }
}
static void Equal<T>(T expected, T actual)
{
    if (!EqualityComparer<T>.Default.Equals(expected, actual)) throw new Exception($"Expected {expected ?? (object)"null"}, got {actual ?? (object)"null"}");
}
static SportsTableRow Row(string name, string id, string? zone, int rank = 1) => new(rank, name, null, ["3"], zone is null ? null : "#2AD572", TeamId: id, ZoneKey: zone);
static object FmRow(string name, int rank, string? color) => new
{
    id = name, name, idx = rank, played = 1, wins = 0, draws = 0, losses = 0,
    scoresStr = "0-0", goalConDiff = 0, pts = 0, qualColor = color,
};
static object Part(string name, string key, string title, string color, params string[] teams) => new
{
    leagueName = name,
    legend = new[] { new { title, tKey = key, color, indices = new[] { 0 } } },
    table = new { all = teams.Select((team, index) => FmRow(team, index + 1, index == 0 ? color : null)).ToArray() },
};
static async Task<SportsStandings?> Standings(bool espnFails = false, bool otherSeason = false, int? failedLeague = null)
{
    string[][] teams = [["France", "Germany"], ["Sweden", "Austria"], ["Finland", "Estonia"], ["Malta", "Andorra"]];
    using var cache = new MemoryCache(new MemoryCacheOptions());
    using var http = new HttpClient(new FixtureHandler(uri =>
    {
        if (uri.Host == "www.fotmob.com")
        {
            var id = int.Parse(uri.Query.Split("id=")[1].Split('&')[0]);
            if (id == failedLeague) return null;
            var league = id - 9806;
            if (league is < 0 or > 3) throw new Exception($"Unexpected source id {id}");
            var season = otherSeason && league == 1 ? "2024/2025" : "2026/2027";
            var key = league == 0 ? "championship_playoff" : "promotion";
            var part = new
            {
                leagueName = "Grp. 1",
                legend = new[]
                {
                    new { title = key, tKey = key, color = "#2AD572", indices = league == 3 ? new[] { 0, 1 } : new[] { 0 } },
                    new { title = "Promotion qualification", tKey = "promotionqual", color = "#FFD908", indices = league is 1 or 2 ? new[] { 1 } : Array.Empty<int>() },
                },
                table = new { all = teams[league].Select((name, index) => FmRow(name, index + 1, null)).ToArray() },
            };
            return JsonSerializer.Serialize(new { details = new { name = $"UEFA Nations League {(char)('A' + league)}", selectedSeason = season }, table = new[] { new { data = new { tables = new[] { part } } } } });
        }
        if (uri.AbsolutePath.EndsWith("/standings"))
        {
            if (espnFails) return null;
            return JsonSerializer.Serialize(new { season = new { displayName = "2026-27" }, children = teams.Select((group, index) => new
            {
                name = $"Group {(char)('A' + index)}1",
                standings = new { entries = group.Select((name, rank) => new
                {
                    team = new { displayName = name },
                    stats = new[] { new { name = "rank", value = rank + 1, displayValue = (rank + 1).ToString() } },
                }).ToArray() },
            }).ToArray() });
        }
        if (uri.AbsolutePath.EndsWith("/scoreboard")) return "{\"events\":[]}";
        throw new Exception($"Unexpected request {uri}");
    }));
    var service = new SportsService(http, cache, new FotMobService(http, cache));
    return await service.GetStandingsAsync("soccer/uefa.nations", null, CancellationToken.None);
}

static async Task<SportsStandings?> SourceStandings(string competition, string espnSeason, string sourceSeason, object[] parts, string? requestedSeason = null)
{
    var source = FotMobService.ParseLeague(JsonSerializer.Serialize(new { details = new { selectedSeason = sourceSeason }, table = new[] { new { data = new { tables = parts } } } }));
    var names = source.Table!.Groups[0].Rows.Select(row => row.Name).ToArray();
    using var cache = new MemoryCache(new MemoryCacheOptions());
    using var http = new HttpClient(new FixtureHandler(uri =>
    {
        if (uri.Host == "www.fotmob.com") return JsonSerializer.Serialize(new { details = new { selectedSeason = sourceSeason }, table = new[] { new { data = new { tables = parts } } } });
        if (uri.AbsolutePath.EndsWith("/standings")) return JsonSerializer.Serialize(new { season = new { displayName = espnSeason }, children = new[] { new { name = "Group K", standings = new { entries = names.Select((name, index) => new {
            team = new { displayName = name }, stats = new[] {
                new { name = "rank", value = index + 1, displayValue = (index + 1).ToString() },
                new { name = "gamesPlayed", value = 1, displayValue = "1" },
                new { name = "wins", value = 0, displayValue = "0" },
                new { name = "ties", value = 0, displayValue = "0" },
                new { name = "losses", value = 0, displayValue = "0" },
                new { name = "pointsFor", value = 0, displayValue = "0" },
                new { name = "pointsAgainst", value = 0, displayValue = "0" },
                new { name = "pointDifferential", value = 0, displayValue = "0" },
                new { name = "points", value = 0, displayValue = "0" },
            },
        }).ToArray() } } } });
        if (uri.AbsolutePath.EndsWith("/scoreboard")) return "{\"events\":[]}";
        throw new Exception($"Unexpected request {uri}");
    }));
    return await new SportsService(http, cache, new FotMobService(http, cache)).GetStandingsAsync(competition, null, CancellationToken.None, requestedSeason);
}

sealed class FixtureHandler(Func<Uri, string?> response) : HttpMessageHandler
{
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var json = response(request.RequestUri!);
        return Task.FromResult(new HttpResponseMessage(json is null ? HttpStatusCode.ServiceUnavailable : HttpStatusCode.OK)
        {
            Content = new StringContent(json ?? "unavailable"),
        });
    }
}
