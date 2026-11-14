using System.Text.Json;

namespace Standalone.Api.Services;

/// <summary>The TV channels and streaming services that show a match in one country (ISO code: DE, AT, CH, GB, US).</summary>
public sealed record SportsBroadcast(string Country, IReadOnlyList<string> Channels);

/// <summary>Where a match is shown, per country; <c>Sources</c> names the sources the lists come from (FotMob, ESPN).</summary>
public sealed record SportsBroadcasts(IReadOnlyList<SportsBroadcast> Countries, IReadOnlyList<string> Sources);

public sealed partial class SportsService
{
    /// <summary>
    /// The broadcasters of a match: for football FotMob's TV listing per country (the match is found like for the line-ups);
    /// ESPN's channels (mostly US) are added to the US list. Null when the match itself is not reachable.
    /// </summary>
    public async Task<SportsBroadcasts?> GetBroadcastsAsync(string competition, string id, CancellationToken cancellationToken)
    {
        var match = await GetMatchAsync(competition, id, cancellationToken);
        if (match is null) return null;

        var countries = new List<SportsBroadcast>();
        var sources = new List<string>();
        if (fotMob is not null && competition.StartsWith("soccer/", StringComparison.Ordinal)
            && await fotMob.GetBroadcastsAsync(match.Start, match.Home.Name, match.Away.Name, cancellationToken) is { } listed)
        {
            countries.AddRange(listed);
            if (listed.Any(country => country.Channels.Count > 0)) sources.Add("FotMob");
        }

        var espn = match.Broadcasts ?? [];
        if (espn.Count > 0)
        {
            var us = countries.FindIndex(country => country.Country == "US");
            // FotMob writes "Paramount+ (US)", ESPN "Paramount+": the same channel only once
            var usChannels = us >= 0 ? countries[us].Channels : [];
            var known = usChannels.Select(name => name.Replace("(US)", string.Empty, StringComparison.OrdinalIgnoreCase).Trim()).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var channels = usChannels.Concat(espn.Where(name => !known.Contains(name))).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
            if (us >= 0) countries[us] = countries[us] with { Channels = channels };
            else countries.Add(new SportsBroadcast("US", channels));
            sources.Add("ESPN");
        }

        return new SportsBroadcasts(countries, sources);
    }
}

public sealed partial class FotMobService
{
    private static readonly TimeSpan TvCache = TimeSpan.FromMinutes(30);

    /// <summary>The countries whose TV listing is read: the German-speaking ones first, then the UK and the US.</summary>
    public static readonly string[] BroadcastCountries = ["DE", "AT", "CH", "GB", "US"];

    /// <summary>FotMob's TV listing of the match for each country, or null when FotMob does not have the match.</summary>
    public async Task<IReadOnlyList<SportsBroadcast>?> GetBroadcastsAsync(DateTimeOffset start, string home, string away, CancellationToken cancellationToken)
    {
        var matchId = await FindMatchIdAsync(start, home, away, cancellationToken);
        if (matchId is null) return null;
        return await Task.WhenAll(BroadcastCountries.Select(async country =>
        {
            var json = await GetCachedAsync($"fotmob:tv:{matchId}:{country}", $"{Api}/tvlisting?matchId={matchId}&countryCode={country}", TvCache, cancellationToken);
            return new SportsBroadcast(country, json is null ? [] : ParseTvListing(json));
        }));
    }

    /// <summary>
    /// "WOW / Sky Bundesliga 2" is two channels. FotMob's affiliate links (tracking links to subscriptions) are not passed on.
    /// </summary>
    public static IReadOnlyList<string> ParseTvListing(string json)
    {
        using var document = JsonDocument.Parse(json);
        var name = Text(document.RootElement, "name");
        return string.IsNullOrWhiteSpace(name)
            ? []
            : name.Split(" / ", StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
    }
}
