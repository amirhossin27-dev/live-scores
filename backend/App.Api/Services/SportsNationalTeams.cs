using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;

namespace Standalone.Api.Services;

public sealed record SportsNationalTeam(string Id, string Name);

/// <summary>Failed distinguishes an unavailable source from a country without a safely identified senior team.</summary>
public sealed record SportsNationalTeamResolution(SportsNationalTeam? Team, bool Failed = false);

public sealed partial class FotMobService
{
    public static bool IsValidNationalTeamCode(string? code) => code is { Length: 3 } && code.All(char.IsAsciiLetter);

    /// <summary>
    /// Resolve a nationality to its men's senior national team. No ids are guessed: search must give an exact country alias,
    /// and the team's own page must confirm the id, country name, international team classification and male gender.
    /// Women, youth teams, similarly named clubs and ambiguous results are never substituted.
    /// </summary>
    public async Task<SportsNationalTeamResolution> GetNationalTeamAsync(string code, CancellationToken cancellationToken)
    {
        if (!IsValidNationalTeamCode(code)) return new(null);
        var normalizedCode = SportsCountries.CanonicalCode(code) ?? code.ToUpperInvariant();
        var names = SportsCountries.NamesForCode(normalizedCode);
        if (names.Count == 0) return new(null);
        return (await cache.GetOrCreateAsync($"fotmob:national-team:{normalizedCode}", async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(12);
            foreach (var name in names)
            {
                var results = await SearchAsync(name, "en", cancellationToken);
                if (results is null)
                {
                    entry.AbsoluteExpirationRelativeToNow = FailureCache;
                    return new SportsNationalTeamResolution(null, Failed: true);
                }
                var candidates = results.Where(result => result.Kind == "national"
                    && ExactCountryName(result.Name, names)
                    && (result.Country?.Code is null || string.Equals(SportsCountries.CanonicalCode(result.Country.Code) ?? result.Country.Code, normalizedCode, StringComparison.OrdinalIgnoreCase)))
                    .DistinctBy(result => result.Id).ToArray();
                if (candidates.Length == 0) continue;
                // Two exact senior-looking matches are ambiguous. Never select the first merely because it ranks higher.
                if (candidates.Length != 1) return new SportsNationalTeamResolution(null);
                var candidate = candidates[0];
                var json = await GetCachedAsync($"fotmob:team:{candidate.Id}", $"{Api}/teams?id={candidate.Id}&ccode3=DEU", TeamCache, cancellationToken);
                if (json is null)
                {
                    entry.AbsoluteExpirationRelativeToNow = FailureCache;
                    return new SportsNationalTeamResolution(null, Failed: true);
                }
                using var document = JsonDocument.Parse(json);
                if (!TryChild(document.RootElement, "details", out var details))
                {
                    entry.AbsoluteExpirationRelativeToNow = FailureCache;
                    return new SportsNationalTeamResolution(null, Failed: true);
                }
                var confirmedName = Text(details, "name");
                if (Text(details, "id") == candidate.Id && Text(details, "type") == "team"
                    && Text(details, "country") == "INT" && Text(details, "gender") == "male"
                    && confirmedName is not null && ExactCountryName(confirmedName, names))
                    return new SportsNationalTeamResolution(new SportsNationalTeam(candidate.Id, confirmedName.Trim()));
            }
            return new SportsNationalTeamResolution(null);
        }))!;
    }

    private static bool ExactCountryName(string name, IReadOnlyList<string> names) =>
        names.Any(alias => string.Equals(Plain(name), Plain(alias), StringComparison.Ordinal));
}
