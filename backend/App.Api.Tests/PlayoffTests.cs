using System.Text.Json;
using Standalone.Api.Services;

static class PlayoffTests
{
    public static async Task Run(Func<string, Func<Task>, Task> test)
    {
        await test("NBA distinguishes direct playoff seeds, play-in seeds and unqualified seeds", () =>
        {
            var table = Parse("basketball/nba", "2026-27", [Group("Eastern Conference", [Entry(11), Entry(6), Entry(7), Entry(10)])]);
            Check("playoff_berth", Find(table, 6).ZoneKey);
            Check("playin", Find(table, 7).ZoneKey);
            Check("playin", Find(table, 10).ZoneKey);
            Check(null, Find(table, 11).ZoneKey);
            return Task.CompletedTask;
        });
        await test("NFL first seed has a bye and seeds two through seven enter the wild-card round", () =>
        {
            var table = Parse("football/nfl", "2026", [Group("AFC", [Entry(8), Entry(7), Entry(4), Entry(1)])]);
            Check("playoff_bye", Find(table, 1).ZoneKey);
            Check("wildcard", Find(table, 4).ZoneKey);
            Check("wildcard", Find(table, 7).ZoneKey);
            Check(null, Find(table, 8).ZoneKey);
            return Task.CompletedTask;
        });
        await test("MLB marks Division Series byes separately from Wild Card Series", () =>
        {
            var table = Parse("baseball/mlb", "2026", [Group("American League", [Entry(7), Entry(6), Entry(3), Entry(2)])]);
            Check("division_series", Find(table, 2).ZoneKey);
            Check("wildcard_series", Find(table, 3).ZoneKey);
            Check("wildcard_series", Find(table, 6).ZoneKey);
            Check(null, Find(table, 7).ZoneKey);
            return Task.CompletedTask;
        });
        await test("WNBA qualifies eight teams league-wide rather than eight per conference", () =>
        {
            var table = SportsService.ParseStandings("basketball/wnba", JsonSerializer.Serialize(new {
                season = new { displayName = "2026" }, standings = new { entries = new[] { Entry(1), Entry(8), Entry(9) } },
            })).Table!;
            Check("playoff_berth", Find(table, 8).ZoneKey);
            Check(null, Find(table, 9).ZoneKey);
            var conferences = Parse("basketball/wnba", "2026", [Group("East", [Entry(1), Entry(2)]), Group("West", [Entry(3), Entry(4)])]);
            Check(null, Find(conferences, 1).ZoneKey);
            return Task.CompletedTask;
        });
        await test("NHL includes the third division team even below eighth in conference and only two wild cards", () =>
        {
            var table = Parse("hockey/nhl", "2026-27", [new { name = "Eastern Conference", children = new[] {
                Group("Atlantic Division", Enumerable.Range(1, 6).Select(seed => Entry(seed)).ToArray()),
                Group("Metropolitan Division", Enumerable.Range(7, 4).Select(seed => Entry(seed)).ToArray()),
            } }]);
            Check("stanley_cup_playoffs", Find(table, 9).ZoneKey);
            Check("wildcard", Find(table, 4).ZoneKey);
            Check("wildcard", Find(table, 5).ZoneKey);
            Check(null, Find(table, 6).ZoneKey);
            return Task.CompletedTask;
        });
        await test("missing seeds and historical formats never receive today's playoff allocations", () =>
        {
            var table = Parse("basketball/nba", "2018-19", [Group("East", [Entry(6), Entry(7)])]);
            Check(null, Find(table, 6).ZoneKey);
            table = Parse("football/nfl", "2026", [Group("AFC", [Entry(1, seed: 0), Entry(2, seed: 0)])]);
            Check(null, Find(table, 1).ZoneKey);
            return Task.CompletedTask;
        });
        await test("provider playoff descriptions take precedence over inferred allocations", () =>
        {
            var table = Parse("basketball/nba", "2026-27", [Group("East", [Entry(1, note: new { color = "#123456", description = "Special tournament berth" })])]);
            Check("espn:special tournament berth", Find(table, 1).ZoneKey);
            return Task.CompletedTask;
        });
    }
    private static SportsTable Parse(string competition, string season, object[] children) => SportsService.ParseStandings(competition,
        JsonSerializer.Serialize(new { season = new { displayName = season }, children })).Table!;
    private static object Group(string name, object[] entries) => new { name, standings = new { entries } };
    private static object Entry(int id, int? seed = null, object? note = null) => new {
        team = new { id = id.ToString(), displayName = $"Team {id}" },
        stats = new[] { new { name = "playoffSeed", value = seed ?? id, displayValue = (seed ?? id).ToString() } }, note,
    };
    private static SportsTableRow Find(SportsTable table, int id) => table.Groups.SelectMany(group => group.Rows).Single(row => row.Name == $"Team {id}");
    private static void Check(string? expected, string? actual)
    {
        if (expected != actual) throw new Exception($"Expected {expected ?? "null"}, got {actual ?? "null"}");
    }
}
