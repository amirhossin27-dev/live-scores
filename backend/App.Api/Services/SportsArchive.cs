using System.Globalization;
using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Caching.Memory;

namespace Standalone.Api.Services;

public sealed record SportsArchiveSeason(string Name, int Value);
public sealed record SportsArchiveCatalog(string? SelectedSeason, IReadOnlyList<SportsArchiveSeason> Seasons);

/// <summary>Historical tables and complete scorer lists from the existing Transfermarkt provider.</summary>
public sealed partial class TransfermarktService
{
    private const int MaxScorerPages = 40;
    private static readonly Dictionary<string, (string Id, string Slug)> ArchiveLeagues = new(StringComparer.Ordinal)
    {
        ["soccer/ger.1"] = ("L1", "bundesliga"), ["soccer/ger.2"] = ("L2", "2-bundesliga"),
        ["soccer/eng.1"] = ("GB1", "premier-league"), ["soccer/eng.2"] = ("GB2", "championship"),
        ["soccer/fra.1"] = ("FR1", "ligue-1"), ["soccer/ita.1"] = ("IT1", "serie-a"),
        ["soccer/esp.1"] = ("ES1", "laliga"), ["soccer/ksa.1"] = ("SA1", "saudi-pro-league"),
        ["soccer/tur.1"] = ("TR1", "super-lig"), ["soccer/ned.1"] = ("NL1", "eredivisie"),
        ["soccer/por.1"] = ("PO1", "liga-portugal"), ["soccer/bel.1"] = ("BE1", "jupiler-pro-league"),
        ["soccer/aut.1"] = ("A1", "bundesliga"), ["soccer/sui.1"] = ("C1", "super-league"),
        ["soccer/sco.1"] = ("SC1", "scottish-premiership"),
    };

    public static bool SupportsArchive(string competition) => ArchiveLeagues.ContainsKey(competition);

    public async Task<SportsArchiveCatalog?> GetArchiveCatalogAsync(string competition, CancellationToken cancellationToken)
    {
        if (!ArchiveLeagues.ContainsKey(competition)) return null;
        return await cache.GetOrCreateAsync($"sports:archive:catalog:{competition}", async entry =>
        {
            try
            {
                var html = await ArchivePageAsync(competition, DateTime.UtcNow.Year, 1, false, cancellationToken);
                var catalog = ParseArchiveCatalog(html);
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(12);
                return catalog;
            }
            catch (Exception exception) when (ArchiveFailure(exception, cancellationToken))
            {
                System.Diagnostics.Trace.TraceWarning("Data source request failed: {0}", exception.GetType().Name);
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(1);
                return null;
            }
        });
    }

    public async Task<SportsScorers?> GetArchiveScorersAsync(string competition, string? season, CancellationToken cancellationToken)
    {
        var catalog = await GetArchiveCatalogAsync(competition, cancellationToken);
        season = SportsSeasons.Normalize(season) ?? catalog?.SelectedSeason;
        var option = catalog?.Seasons.FirstOrDefault(item => item.Name == season);
        if (option is null) return null;
        return await cache.GetOrCreateAsync($"sports:archive:scorers:{competition}:{season}", async entry =>
        {
            try
            {
                var first = await ArchivePageAsync(competition, option.Value, 1, false, cancellationToken);
                var pages = ArchivePagePattern().Matches(first).Select(match => int.Parse(match.Groups[1].Value, CultureInfo.InvariantCulture)).DefaultIfEmpty(1).Max();
                if (pages > MaxScorerPages) throw new JsonException("The scorer archive exceeds the supported page count.");
                using var concurrency = new SemaphoreSlim(3);
                var more = await Task.WhenAll(Enumerable.Range(2, pages - 1).Select(async page =>
                {
                    await concurrency.WaitAsync(cancellationToken);
                    try { return await ArchivePageAsync(competition, option.Value, page, false, cancellationToken); }
                    finally { concurrency.Release(); }
                }));
                var players = new[] { first }.Concat(more).SelectMany(html => ParseArchiveScorers(html, season!)).ToArray();
                // A repeated page must never masquerade as a complete historical ranking.
                if (players.Select(player => player.Id).Distinct().Count() != players.Length)
                    throw new JsonException("The scorer archive repeated a player or page.");
                entry.AbsoluteExpirationRelativeToNow = ArchiveLifetime(option.Value);
                return new SportsScorers(competition, season, DateTimeOffset.UtcNow, "transfermarkt", players.Length > 0,
                    players.OrderByDescending(player => player.Goals).ThenByDescending(player => player.Assists).ThenBy(player => player.Name, StringComparer.Ordinal).ToArray(),
                    catalog!.Seasons.Select(item => item.Name).ToArray());
            }
            catch (Exception exception) when (ArchiveFailure(exception, cancellationToken))
            {
                System.Diagnostics.Trace.TraceWarning("Data source request failed: {0}", exception.GetType().Name);
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(1);
                return null;
            }
        });
    }

    public async Task<SportsTable?> GetArchiveTableAsync(string competition, string season, CancellationToken cancellationToken)
    {
        var catalog = await GetArchiveCatalogAsync(competition, cancellationToken);
        var option = catalog?.Seasons.FirstOrDefault(item => item.Name == SportsSeasons.Normalize(season));
        if (option is null) return null;
        return await cache.GetOrCreateAsync($"sports:archive:table:{competition}:{option.Name}", async entry =>
        {
            try
            {
                var html = await ArchivePageAsync(competition, option.Value, 1, true, cancellationToken);
                var table = ParseArchiveTable(html, option.Name);
                entry.AbsoluteExpirationRelativeToNow = ArchiveLifetime(option.Value);
                return table;
            }
            catch (Exception exception) when (ArchiveFailure(exception, cancellationToken))
            {
                System.Diagnostics.Trace.TraceWarning("Data source request failed: {0}", exception.GetType().Name);
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(1);
                return null;
            }
        });
    }

    private Task<string> ArchivePageAsync(string competition, int year, int page, bool table, CancellationToken cancellationToken) =>
        cache.GetOrCreateAsync($"sports:archive:page:{competition}:{year}:{table}:{page}", async entry =>
        {
            var league = ArchiveLeagues[competition];
            var path = table ? "tabelle" : "scorerliste";
            var url = $"{EnglishSite}/{league.Slug}/{path}/wettbewerb/{league.Id}/saison_id/{year}" + (page == 1 ? "" : $"/page/{page}");
            var html = await DownloadArchiveAsync(url, cancellationToken);
            // Validate before caching: error and challenge pages are not archive data.
            _ = ParseArchiveCatalog(html);
            entry.AbsoluteExpirationRelativeToNow = ArchiveLifetime(year);
            return html;
        })!;

    private async Task<string> DownloadArchiveAsync(string url, CancellationToken cancellationToken)
    {
        try { return await http.GetStringAsync(url, cancellationToken); }
        catch (HttpRequestException exception) when (!cancellationToken.IsCancellationRequested
            && exception.StatusCode is null or HttpStatusCode.RequestTimeout or HttpStatusCode.BadGateway or HttpStatusCode.ServiceUnavailable or HttpStatusCode.GatewayTimeout)
        {
            // One retry for a failed, idempotent GET; access denials and invalid HTML are never retried.
            return await http.GetStringAsync(url, cancellationToken);
        }
    }

    private static TimeSpan ArchiveLifetime(int year) => year < DateTime.UtcNow.Year - 1 ? HistoryCache : TimeSpan.FromSeconds(30);
    private static bool ArchiveFailure(Exception exception, CancellationToken cancellationToken) => exception is HttpRequestException or JsonException or InvalidOperationException
        || exception is TaskCanceledException && !cancellationToken.IsCancellationRequested;

    public static SportsArchiveCatalog ParseArchiveCatalog(string html)
    {
        var select = ArchiveSelectPattern().Match(html);
        if (!select.Success) throw new JsonException("The archive season selector is missing.");
        var seasons = new List<SportsArchiveSeason>();
        string? selected = null;
        foreach (Match option in ArchiveOptionPattern().Matches(select.Groups[1].Value))
        {
            var value = ArchiveValuePattern().Match(option.Groups[1].Value);
            if (!value.Success) continue;
            var year = int.Parse(value.Groups[1].Value, CultureInfo.InvariantCulture);
            var label = Plain(option.Groups[2].Value);
            string? name = label.Length == 4 && int.TryParse(label, out _) ? SportsSeasons.Normalize(label) : null;
            if (label.Contains('/'))
            {
                var parts = label.Split('/');
                if (parts.Length == 2 && parts[0].Length == 2 && int.TryParse(parts[0], out var shortYear))
                    name = SportsSeasons.Normalize($"{year / 100 * 100 + shortYear}/{parts[1]}");
                else name = SportsSeasons.Normalize(label);
            }
            if (name is null) continue;
            seasons.Add(new SportsArchiveSeason(name, year));
            if (option.Groups[1].Value.Contains("selected", StringComparison.OrdinalIgnoreCase)) selected = name;
        }
        if (seasons.Count == 0 || selected is null) throw new JsonException("The archive did not identify its selected season.");
        return new SportsArchiveCatalog(selected, seasons.DistinctBy(item => item.Name).OrderByDescending(item => item.Name, StringComparer.Ordinal).ToArray());
    }

    private static string ArchiveBody(string html, string season)
    {
        if (ParseArchiveCatalog(html).SelectedSeason != SportsSeasons.Normalize(season))
            throw new JsonException("The archive returned a different season.");
        var start = html.IndexOf("class=\"items\"", StringComparison.Ordinal);
        if (start < 0) throw new JsonException("The archive table is missing.");
        var body = html.IndexOf("<tbody>", start, StringComparison.Ordinal);
        var end = body < 0 ? -1 : html.IndexOf("</tbody>", body, StringComparison.Ordinal);
        if (end < 0) throw new JsonException("The archive table is incomplete.");
        return html[(body + 7)..end];
    }

    public static IReadOnlyList<SportsScorer> ParseArchiveScorers(string html, string season)
    {
        var rows = new List<SportsScorer>();
        foreach (var row in RowPattern().Split(ArchiveBody(html, season)).Skip(1))
        {
            var player = ArchivePlayerPattern().Match(row);
            var inlineEnd = row.IndexOf("</table>", StringComparison.Ordinal);
            if (!player.Success || inlineEnd < 0) throw new JsonException("An archive scorer row is invalid.");
            var cells = CellPattern().Matches(row[(inlineEnd + 8)..]).Select(match => match.Groups[1].Value).ToArray();
            if (cells.Length != 7) throw new JsonException("The archive scorer columns changed.");
            var club = ArchiveClubPattern().Match(cells[0]);
            var country = ArchiveFlagPattern().Match(cells[1]);
            rows.Add(new SportsScorer($"transfermarkt:{player.Groups[1].Value}", WebUtility.HtmlDecode(player.Groups[2].Value).Trim(),
                club.Success ? WebUtility.HtmlDecode(club.Groups[1].Value) : null, null,
                ArchiveCount(cells[4]), ArchiveCount(cells[5]), ArchiveCount(cells[6]),
                country.Success ? SportsCountries.FromName(WebUtility.HtmlDecode(country.Groups[1].Value)) : null,
                club.Success ? ArchiveCrest(club.Groups[2].Value) : null, false));
        }
        return rows;
    }

    public static SportsTable? ParseArchiveTable(string html, string season)
    {
        var rows = new List<SportsTableRow>();
        foreach (Match row in ArchiveTableRowPattern().Matches(ArchiveBody(html, season)))
        {
            var cells = CellPattern().Matches(row.Groups[1].Value).Select(match => match.Groups[1].Value).ToArray();
            if (cells.Length != 10) throw new JsonException("The archive table columns changed.");
            var club = ArchiveClubPattern().Match(cells[2]);
            if (!club.Success || !int.TryParse(Plain(cells[0]), out var rank)) throw new JsonException("An archive table row is invalid.");
            var values = cells.Skip(3).Select(Plain).ToArray();
            // Before the three-point rule the source includes points lost (e.g. 57:19); retain its earned total.
            values[6] = values[6].Split(':')[0];
            rows.Add(new SportsTableRow(rank, WebUtility.HtmlDecode(club.Groups[1].Value), ArchiveCrest(club.Groups[2].Value), values));
        }
        return rows.Count == 0 ? null : new SportsTable(["gamesPlayed", "wins", "ties", "losses", "goals", "goalDifference", "points"], [new SportsTableGroup(null, rows)], [], "transfermarkt");
    }

    private static int? ArchiveCount(string cell) => int.TryParse(Plain(cell), NumberStyles.None, CultureInfo.InvariantCulture, out var value) && value >= 0 ? value : null;
    private static string ArchiveCrest(string id) => $"https://img.a.transfermarkt.technology/wappen/small/{id}.png";

    [GeneratedRegex(@"<select\b[^>]*name=""saison_id""[^>]*>(.*?)</select>", RegexOptions.Singleline | RegexOptions.CultureInvariant)]
    private static partial Regex ArchiveSelectPattern();
    [GeneratedRegex(@"<option\b([^>]*)>(.*?)</option>", RegexOptions.Singleline | RegexOptions.CultureInvariant)]
    private static partial Regex ArchiveOptionPattern();
    [GeneratedRegex(@"\bvalue=""(\d{4})""", RegexOptions.CultureInvariant)]
    private static partial Regex ArchiveValuePattern();
    [GeneratedRegex(@"/page/(\d+)", RegexOptions.CultureInvariant)]
    private static partial Regex ArchivePagePattern();
    [GeneratedRegex(@"<a[^>]*href=""/[^""]+/profil/spieler/(\d{1,12})""[^>]*>([^<]+)</a>", RegexOptions.CultureInvariant)]
    private static partial Regex ArchivePlayerPattern();
    [GeneratedRegex(@"<a[^>]*title=""([^""]+)""[^>]*href=""/[^""]+/(?:startseite|spielplan)/verein/(\d{1,12})/saison_id/\d{4}""", RegexOptions.CultureInvariant)]
    private static partial Regex ArchiveClubPattern();
    [GeneratedRegex(@"<img[^>]*title=""([^""]+)""[^>]*class=""flaggenrahmen""", RegexOptions.CultureInvariant)]
    private static partial Regex ArchiveFlagPattern();
    [GeneratedRegex(@"<tr\b[^>]*>(.*?)</tr>", RegexOptions.Singleline | RegexOptions.CultureInvariant)]
    private static partial Regex ArchiveTableRowPattern();
}
