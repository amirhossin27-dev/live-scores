using System.Text.Json;

namespace Standalone.Api.Services;

public sealed partial class SportsService
{
    /// <summary>
    /// ESPN's US standings supply playoff seeds, but usually omit rank legends. Use the provider's seeds,
    /// never a row index, and only for known formats. WNBA seeds must be league-wide; NHL berths depend on divisions.
    /// Format references: nba.com/news/nba-play-in-tournament; wnba.com/news/2026-wnba-postseason-faq;
    /// media.nfl.com/football-information/2026/news/2026-nfl-schedule-announced;
    /// nhl.com/info/standings-info/playoff-format; mlb.com/news/mlb-playoff-format-faq.
    /// </summary>
    private static Dictionary<string, SportsZone> PlayoffZones(string competition, JsonElement root, IReadOnlyList<JsonElement> nodes, string? season)
    {
        var result = new Dictionary<string, SportsZone>(StringComparer.Ordinal);
        if (season is not { Length: >= 4 } || !int.TryParse(season[..4], out var year)) return result;
        var berth = new SportsZone("#7E22CE", new("playoff_berth", "Playoffs"), "playoff_berth");
        var playIn = new SportsZone("#A16207", new("playin", "Play-In Tournament"), "playin");
        var bye = new SportsZone("#0369A1", new("playoff_bye", "Playoffs with a first-round bye"), "playoff_bye");
        var wildCard = new SportsZone("#A16207", new("wildcard", "Playoffs (wild card)"), "wildcard");
        var divisionSeries = new SportsZone("#0369A1", new("division_series", "Division Series (first-round bye)"), "division_series");
        var wildCardSeries = new SportsZone("#A16207", new("wildcard_series", "Wild Card Series"), "wildcard_series");
        var stanleyCup = new SportsZone("#7E22CE", new("stanley_cup_playoffs", "Stanley Cup Playoffs"), "stanley_cup_playoffs");

        static JsonElement[] Entries(JsonElement node) => node.TryGetProperty("standings", out var table)
            && table.TryGetProperty("entries", out var entries) && entries.ValueKind == JsonValueKind.Array ? entries.EnumerateArray().ToArray() : [];
        static int? Seed(JsonElement entry)
        {
            if (!entry.TryGetProperty("stats", out var stats) || stats.ValueKind != JsonValueKind.Array) return null;
            foreach (var stat in stats.EnumerateArray())
                if (Text(stat, "name") == "playoffSeed" && stat.TryGetProperty("value", out var value)
                    && value.ValueKind == JsonValueKind.Number && value.TryGetDouble(out var number)
                    && number > 0 && number <= int.MaxValue && number == Math.Truncate(number)) return (int)number;
            return null;
        }
        void Add(JsonElement entry, SportsZone? zone)
        {
            if (zone is not null && entry.TryGetProperty("team", out var team) && Text(team, "id") is { } id) result[id] = zone;
        }

        if (competition == "hockey/nhl")
        {
            // The 2020 and 2021 postseasons used special formats. Modern wildcard divisions resumed in 2021/22.
            if (year < 2021 || !root.TryGetProperty("children", out var conferences) || conferences.ValueKind != JsonValueKind.Array) return result;
            foreach (var conference in conferences.EnumerateArray())
            {
                if (!conference.TryGetProperty("children", out var children) || children.ValueKind != JsonValueKind.Array) continue;
                var divisions = children.EnumerateArray().Select(Entries).Where(entries => entries.Length > 0).ToArray();
                if (divisions.Length != 2 || divisions.Any(entries => entries.Length < 3)) continue;
                var all = divisions.SelectMany(entries => entries).ToArray();
                if (all.Any(entry => Seed(entry) is null) || all.Select(Seed).Distinct().Count() != all.Length) continue;
                var direct = divisions.SelectMany(entries => entries.OrderBy(Seed).Take(3)).ToArray();
                var directSeeds = direct.Select(Seed).ToHashSet();
                foreach (var entry in direct) Add(entry, stanleyCup);
                foreach (var entry in all.Where(entry => !directSeeds.Contains(Seed(entry))).OrderBy(Seed).Take(2)) Add(entry, wildCard);
            }
            return result;
        }

        // A conference-local WNBA seed cannot determine league-wide qualification.
        if (competition == "basketball/wnba" && (nodes.Count != 1 || Entries(root).Length == 0)) return result;
        foreach (var node in nodes)
        {
            var entries = Entries(node);
            // Division tables or duplicated/missing seeds do not establish a reliable playoff order.
            if (entries.Any(entry => Seed(entry) is null) || entries.Select(Seed).Distinct().Count() != entries.Length) continue;
            foreach (var entry in entries)
            {
                var seed = Seed(entry)!.Value;
                SportsZone? zone = competition switch
                {
                    "basketball/nba" when year >= 2020 => seed <= 6 ? berth : seed <= 10 ? playIn : null,
                    "basketball/wnba" when year >= 2016 => seed <= 8 ? berth : null,
                    "football/nfl" when year >= 2020 => seed == 1 ? bye : seed <= 7 ? wildCard : null,
                    "baseball/mlb" when year >= 2022 => seed <= 2 ? divisionSeries : seed <= 6 ? wildCardSeries : null,
                    _ => null,
                };
                Add(entry, zone);
            }
        }
        return result;
    }
}
