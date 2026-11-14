using System.Text.Json;

namespace Standalone.Api.Services;

/// <summary>A source country with its canonical FIFA code, ISO flag code and FotMob flag image.</summary>
public sealed record SportsCountry(string Name, string? Code, string? Iso, string? Flag);

/// <summary>The single shared catalog covers every FIFA member, source name aliases and documented source code aliases.</summary>
public static class SportsCountries
{
    public const string CatalogResourceName = "Standalone.Api.SportsCountries.json";
    private sealed record CatalogEntry(string Name, string Fifa, string Iso, string[]? Aliases = null, string[]? CodeAliases = null);
    private static readonly CatalogEntry[] Catalog = LoadCatalog();
    private static readonly (string Name, string Fifa, string Iso)[] Known = Catalog
        .SelectMany(entry => new[] { entry.Name }.Concat(entry.Aliases ?? []).Select(name => (name, entry.Fifa, entry.Iso))).ToArray();

    private static readonly Dictionary<string, string> CanonicalByCode = Catalog
        .SelectMany(entry => new[] { entry.Fifa }.Concat(entry.CodeAliases ?? []).Select(code => (Code: code, entry.Fifa)))
        .ToDictionary(item => item.Code, item => item.Fifa, StringComparer.OrdinalIgnoreCase);

    private static readonly Dictionary<string, string> FotMobImageCode = Catalog.ToDictionary(entry => entry.Fifa,
        entry => entry.CodeAliases?.FirstOrDefault() ?? entry.Fifa, StringComparer.OrdinalIgnoreCase);

    private static readonly Dictionary<string, (string Fifa, string Iso)> ByName =
        Known.ToDictionary(item => item.Name, item => (item.Fifa, item.Iso), StringComparer.OrdinalIgnoreCase);

    private static readonly Dictionary<string, string> IsoByFifa =
        Catalog.ToDictionary(item => item.Fifa, item => item.Iso, StringComparer.OrdinalIgnoreCase);

    private static readonly Dictionary<string, string[]> NamesByFifa =
        Known.GroupBy(item => item.Fifa).ToDictionary(group => group.Key, group => group.Select(item => item.Name).ToArray(), StringComparer.OrdinalIgnoreCase);

    private static CatalogEntry[] LoadCatalog()
    {
        using var stream = typeof(SportsCountries).Assembly.GetManifestResourceStream(CatalogResourceName)
            ?? throw new InvalidOperationException("The shared football country catalog was not embedded in the API.");
        var entries = JsonSerializer.Deserialize<CatalogEntry[]>(stream, new JsonSerializerOptions(JsonSerializerDefaults.Web))
            ?? throw new InvalidOperationException("The shared football country catalog is empty.");
        if (entries.Any(entry => string.IsNullOrWhiteSpace(entry.Name) || entry.Fifa is not { Length: 3 }
            || !entry.Fifa.All(char.IsAsciiLetterUpper) || string.IsNullOrWhiteSpace(entry.Iso)))
            throw new InvalidOperationException("The shared football country catalog has an invalid entry.");
        return entries;
    }

    /// <summary>Translate documented provider aliases such as FotMob SIN to the official FIFA code SGP.</summary>
    public static string? CanonicalCode(string? code) =>
        code is not null && CanonicalByCode.TryGetValue(code, out var canonical) ? canonical : null;

    /// <summary>All known English/source names of a FIFA code or its documented provider alias.</summary>
    public static IReadOnlyList<string> NamesForCode(string? code) =>
        CanonicalCode(code) is { } canonical && NamesByFifa.TryGetValue(canonical, out var names) ? names : [];

    /// <summary>The country of a FIFA/provider code; unknown valid codes remain labelled without a guessed ISO mapping.</summary>
    public static SportsCountry? FromCode(string? code, string? name)
    {
        if (string.IsNullOrWhiteSpace(code) || code.Length != 3 || !code.All(char.IsAsciiLetter)) return string.IsNullOrWhiteSpace(name) ? null : FromName(name);
        var fifa = CanonicalCode(code) ?? code.ToUpperInvariant();
        return new SportsCountry(name?.Trim() ?? fifa, fifa, IsoByFifa.GetValueOrDefault(fifa), FlagUrl(fifa));
    }

    /// <summary>The country of a known source name; an unknown name is retained without guessing a flag.</summary>
    public static SportsCountry? FromName(string? name)
    {
        if (string.IsNullOrWhiteSpace(name)) return null;
        var trimmed = name.Trim();
        return ByName.TryGetValue(trimmed, out var known)
            ? new SportsCountry(trimmed, known.Fifa, known.Iso, FlagUrl(known.Fifa))
            : new SportsCountry(trimmed, null, null, null);
    }

    public static string FlagUrl(string fifa)
    {
        // FotMob's documented SIN image remains valid while the shared FIFA identity is canonical SGP.
        var canonical = CanonicalCode(fifa);
        var imageCode = canonical is null ? fifa : FotMobImageCode[canonical];
        return $"https://images.fotmob.com/image_resources/logo/teamlogo/{imageCode.ToLowerInvariant()}.png";
    }
}
