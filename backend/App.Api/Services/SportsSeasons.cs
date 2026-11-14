using System.Text.Json;

namespace Standalone.Api.Services;

/// <summary>Only published, valid season labels from 1990 onward; never manufacture missing seasons.</summary>
public static class SportsSeasons
{
    public static string? Normalize(string? value) => FotMobService.TryPlayerSeasonDates(value, out var from, out _) && from.Year >= 1990
        ? FotMobService.NormalizePlayerSeason(value) : null;

    public static string[] Combine(params IEnumerable<string?>[] lists) => lists.SelectMany(list => list)
        .Select(Normalize).OfType<string>().Distinct(StringComparer.Ordinal).OrderDescending(StringComparer.Ordinal).ToArray();

    public static string[] FotMob(JsonElement root, bool scorers = false)
    {
        var values = new List<string?>();
        if (root.TryGetProperty("details", out var details))
        {
            values.Add(Text(details, "selectedSeason"));
            values.Add(Text(details, "latestSeason"));
        }
        // `seasons` contains historical winners, even when no table/statistics can be requested for that year.
        var list = root.TryGetProperty("allAvailableSeasons", out var available) ? available : default;
        if (scorers && root.TryGetProperty("stats", out var stats) && stats.ValueKind == JsonValueKind.Object
            && stats.TryGetProperty("seasonsWithLinks", out var linked)) list = linked;
        if (list.ValueKind == JsonValueKind.Array)
            values.AddRange(list.EnumerateArray().Where(item => item.ValueKind == JsonValueKind.String).Select(item => item.GetString()));
        return Combine(values);
    }

    private static string? Text(JsonElement node, string property) => node.ValueKind == JsonValueKind.Object
        && node.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
}
