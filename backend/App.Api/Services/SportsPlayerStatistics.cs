using System.Globalization;
using System.Text.Json;

namespace Standalone.Api.Services;

public sealed partial class FotMobService
{
    private static readonly HashSet<string> SeasonCountKeys = new(StringComparer.Ordinal)
    {
        "goals", "assists", "yellow_cards", "red_cards",
    };

    private static SportsSeasonStat? ReadSeasonStat(JsonElement item, string valueProperty)
    {
        var title = Text(item, "title");
        var value = Text(item, valueProperty);
        if (title is null || string.IsNullOrWhiteSpace(value)) return null;
        if (double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out var number))
            value = number.ToString("0.##", CultureInfo.InvariantCulture);
        return new SportsSeasonStat(Text(item, "localizedTitleId") ?? title, title, value);
    }

    private static void AddMissingSeasonCounts(List<SportsSeasonStat> stats, JsonElement items, string valueProperty)
    {
        if (items.ValueKind != JsonValueKind.Array) return;
        foreach (var item in items.EnumerateArray())
        {
            if (ReadSeasonStat(item, valueProperty) is { } stat && SeasonCountKeys.Contains(stat.Key) && !stats.Any(existing => existing.Key == stat.Key))
                stats.Add(stat);
        }
    }

    private static (string? Season, string? League) PlayerSeasonSelection(JsonElement profile, string entry)
    {
        if (!TryChild(profile, "statSeasons", out var seasons) || seasons.ValueKind != JsonValueKind.Array) return (null, null);
        foreach (var season in seasons.EnumerateArray())
        {
            if (!TryChild(season, "tournaments", out var tournaments) || tournaments.ValueKind != JsonValueKind.Array) continue;
            foreach (var tournament in tournaments.EnumerateArray())
                if (Text(tournament, "entryId") == entry) return (Text(season, "seasonName"), Text(tournament, "tournamentId"));
        }
        return (null, null);
    }

    /// <summary>
    /// Fill headline counts from the same season and competition only. Goalkeepers' goals/assists are published in career
    /// tournament rows rather than their stat cards. Unknown counts remain unknown; explicit zero is a real value.
    /// </summary>
    private static void CompletePlayerSeasonCounts(List<SportsSeasonStat> stats, JsonElement profile, string? season, string? league)
    {
        var normalized = NormalizePlayerSeason(season);
        if (normalized is null || league is null) return;
        if (TryChild(profile, "mainLeague", out var main) && Text(main, "leagueId") == league
            && NormalizePlayerSeason(Text(main, "season")) == normalized && TryChild(main, "stats", out var mainStats))
            AddMissingSeasonCounts(stats, mainStats, "value");

        if (!TryChild(profile, "careerHistory", out var history) || !TryChild(history, "careerItems", out var items)) return;
        var tournaments = new List<JsonElement>();
        foreach (var property in new[] { "senior", "national team" })
        {
            if (!TryChild(items, property, out var group) || !TryChild(group, "seasonEntries", out var entries) || entries.ValueKind != JsonValueKind.Array) continue;
            foreach (var entry in entries.EnumerateArray())
            {
                if (!TryChild(entry, "tournamentStats", out var tournamentStats) || tournamentStats.ValueKind != JsonValueKind.Array) continue;
                var entrySeason = NormalizePlayerSeason(Text(entry, "seasonName"));
                foreach (var tournament in tournamentStats.EnumerateArray())
                {
                    if (Text(tournament, "leagueId") != league) continue;
                    var tournamentSeason = NormalizePlayerSeason(Text(tournament, "seasonName")) ?? entrySeason;
                    if (entrySeason == normalized || tournamentSeason == normalized || tournamentSeason == normalized[..4]) tournaments.Add(tournament);
                }
            }
        }
        if (tournaments.Count == 0) return;
        foreach (var (key, title) in new[] { ("goals", "Goals"), ("assists", "Assists") })
        {
            if (stats.Any(stat => stat.Key == key)) continue;
            var values = tournaments.Select(tournament => WholeText(tournament, key)).ToArray();
            if (values.Any(value => value is null or < 0)) continue;
            stats.Add(new SportsSeasonStat(key, title, values.Sum(value => (long)value!.Value).ToString(CultureInfo.InvariantCulture)));
        }
    }
}
