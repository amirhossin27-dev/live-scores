using System.Globalization;
using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Caching.Memory;

namespace Standalone.Api.Services;

/// <summary>
/// Transfers with their fees and the injury history from Transfermarkt (no official API, no key): the player is looked up with
/// the site's quick search (name, then club and age decide between namesakes); his transfer history is read from the JSON the
/// profile page loads (<c>/ceapi/transferHistory/list/{id}</c>), his injuries from the pages of the injury table (German site
/// for German, English site for English names of the injuries). Everything is cached for a day; a player that is not found
/// clearly gets none.
/// </summary>
public sealed partial class TransfermarktService(HttpClient http, IMemoryCache cache)
{
    private const string Site = "https://www.transfermarkt.de";
    private const string EnglishSite = "https://www.transfermarkt.com";
    private static readonly TimeSpan HistoryCache = TimeSpan.FromHours(24);
    private static readonly TimeSpan FailureCache = TimeSpan.FromMinutes(10);

    /// <summary>The injury table has 15 lines a page; more than five pages (75 injuries) are not read.</summary>
    public const int MaxInjuryPages = 5;

    public sealed record SearchHit(string Id, string Name, string? Club, int? Age);

    public async Task<IReadOnlyList<SportsTransfer>> GetTransfersAsync(string name, string? club, int? age, CancellationToken cancellationToken) =>
        (await cache.GetOrCreateAsync($"transfermarkt:{FotMobService.Plain(name)}|{club}|{age}", async entry =>
        {
            try
            {
                var id = await FindIdAsync(name, club, age, cancellationToken);
                if (id is null)
                {
                    entry.AbsoluteExpirationRelativeToNow = HistoryCache;
                    return (IReadOnlyList<SportsTransfer>)[];
                }

                var history = await http.GetStringAsync($"{Site}/ceapi/transferHistory/list/{id}", cancellationToken);
                entry.AbsoluteExpirationRelativeToNow = HistoryCache;
                return ParseTransfers(history);
            }
            catch (Exception exception) when (exception is HttpRequestException or JsonException or TaskCanceledException && !cancellationToken.IsCancellationRequested)
            {
                System.Diagnostics.Trace.TraceWarning("Data source request failed: {0}", exception.GetType().Name);
                entry.AbsoluteExpirationRelativeToNow = FailureCache;
                return [];
            }
        }))!;

    /// <summary>
    /// The injuries of the player, newest first, with the names in German (<c>de</c>) or English (<c>en</c>); null when the
    /// player is not found clearly or Transfermarkt does not answer (an empty list: found, never injured).
    /// </summary>
    public async Task<IReadOnlyList<SportsInjuryRecord>?> GetInjuriesAsync(string name, string? club, int? age, string language, CancellationToken cancellationToken) =>
        await cache.GetOrCreateAsync($"transfermarkt:injuries:{FotMobService.Plain(name)}|{club}|{age}|{language}", async entry =>
        {
            try
            {
                var id = await FindIdAsync(name, club, age, cancellationToken);
                entry.AbsoluteExpirationRelativeToNow = HistoryCache;
                if (id is null) return null;

                var site = language == "en" ? EnglishSite : Site;
                var first = await http.GetStringAsync($"{site}/spieler/verletzungen/spieler/{id}", cancellationToken);
                var pages = Math.Min(LastPage(first), MaxInjuryPages);
                var more = await Task.WhenAll(Enumerable.Range(2, Math.Max(0, pages - 1))
                    .Select(page => http.GetStringAsync($"{site}/spieler/verletzungen/spieler/{id}/page/{page}", cancellationToken)));
                return (IReadOnlyList<SportsInjuryRecord>?)new[] { first }.Concat(more).SelectMany(ParseInjuries).ToArray();
            }
            catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException && !cancellationToken.IsCancellationRequested)
            {
                System.Diagnostics.Trace.TraceWarning("Data source request failed: {0}", exception.GetType().Name);
                entry.AbsoluteExpirationRelativeToNow = FailureCache;
                return null;
            }
        });

    /// <summary>The Transfermarkt id of the player, cached; null when the search does not find him clearly.</summary>
    private async Task<string?> FindIdAsync(string name, string? club, int? age, CancellationToken cancellationToken) =>
        await cache.GetOrCreateAsync($"transfermarkt:id:{FotMobService.Plain(name)}|{club}|{age}", async entry =>
        {
            var search = await http.GetStringAsync($"{Site}/schnellsuche/ergebnis/schnellsuche?query={Uri.EscapeDataString(name)}", cancellationToken);
            entry.AbsoluteExpirationRelativeToNow = HistoryCache;
            return FindPlayer(ParseSearch(search), name, club, age);
        });

    // ---------- Finding the player ----------

    /// <summary>The player rows of the quick search: id, name, club and age.</summary>
    public static IReadOnlyList<SearchHit> ParseSearch(string html)
    {
        var hits = new List<SearchHit>();
        var start = html.IndexOf("id=\"player-grid\"", StringComparison.Ordinal);
        if (start < 0) return hits;
        var end = html.IndexOf("</tbody>", start, StringComparison.Ordinal);
        var table = end < 0 ? html[start..] : html[start..end];
        foreach (var row in RowPattern().Split(table).Skip(1))
        {
            var player = PlayerPattern().Match(row);
            if (!player.Success) continue;
            var club = ClubPattern().Match(row, player.Index + player.Length);
            var age = AgePattern().Match(row);
            hits.Add(new SearchHit(
                player.Groups[1].Value,
                WebUtility.HtmlDecode(player.Groups[2].Value).Trim(),
                club.Success ? WebUtility.HtmlDecode(club.Groups[1].Value).Trim() : null,
                age.Success ? int.Parse(age.Groups[1].Value, CultureInfo.InvariantCulture) : null));
        }

        return hits;
    }

    /// <summary>
    /// The hit with the same name; among namesakes the one whose club and age fit. When that still leaves more than one,
    /// none is taken (a wrong player's transfers would be worse than none).
    /// </summary>
    public static string? FindPlayer(IReadOnlyList<SearchHit> hits, string name, string? club, int? age)
    {
        var wanted = FotMobService.Plain(name);
        var namesakes = hits.Where(hit => FotMobService.Plain(hit.Name) == wanted).ToList();
        if (namesakes.Count == 0) return null;
        if (namesakes.Count == 1) return namesakes[0].Id;

        var clubWords = club is null ? [] : FotMobService.Words(club);
        var scored = namesakes
            .Select(hit => (hit.Id, Score: (hit.Club is not null && FotMobService.Words(hit.Club).Overlaps(clubWords) ? 2 : 0) + (age is not null && hit.Age == age ? 1 : 0)))
            .OrderByDescending(item => item.Score)
            .ToList();
        return scored[0].Score > 0 && scored[0].Score > scored[1].Score ? scored[0].Id : null;
    }

    // ---------- Transfer history ----------

    public static IReadOnlyList<SportsTransfer> ParseTransfers(string json)
    {
        using var document = JsonDocument.Parse(json);
        if (!document.RootElement.TryGetProperty("transfers", out var transfers) || transfers.ValueKind != JsonValueKind.Array) return [];
        var list = new List<SportsTransfer>();
        foreach (var transfer in transfers.EnumerateArray())
        {
            // announced moves that have not happened yet are left out
            if (transfer.TryGetProperty("upcoming", out var upcoming) && upcoming.ValueKind == JsonValueKind.True) continue;
            if (!DateTimeOffset.TryParse(Text(transfer, "dateUnformatted"), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var date)) continue;
            var to = Club(transfer, "to");
            if (to is null) continue;
            var fee = Text(transfer, "fee") ?? string.Empty;
            var (kind, amount) = Fee(fee);
            list.Add(new SportsTransfer(date, Club(transfer, "from"), to, null, amount, kind, Euros(Text(transfer, "marketValue") ?? string.Empty), Emblem(transfer, "from"), Emblem(transfer, "to"),
                Text(transfer, "season"), Flag(transfer, "from"), Flag(transfer, "to"),
                Uri.TryCreate(new Uri(Site), Text(transfer, "url"), out var detail) && detail.Scheme == "https"
                    && detail.Host == "www.transfermarkt.de" && detail.AbsolutePath.Contains("/transfer_id/") ? detail.AbsoluteUri : null));
        }

        return list;
    }

    private static string? Club(JsonElement transfer, string side) =>
        transfer.TryGetProperty(side, out var club) && club.ValueKind == JsonValueKind.Object && Text(club, "clubName") is { Length: > 0 } name ? WebUtility.HtmlDecode(name).Trim() : null;

    /// <summary>The club's crest (the sharper of the two sizes); none for the special entries ("career break", "without club").</summary>
    private static string? Emblem(JsonElement transfer, string side) =>
        transfer.TryGetProperty(side, out var club) && club.ValueKind == JsonValueKind.Object
        && !(club.TryGetProperty("isSpecial", out var special) && special.ValueKind == JsonValueKind.True)
        && (Text(club, "clubEmblem-2x") ?? Text(club, "clubEmblem-1x")) is { } url && url.StartsWith("https://", StringComparison.Ordinal)
            ? url
            : null;

    private static string? Flag(JsonElement transfer, string side) =>
        transfer.TryGetProperty(side, out var club) && club.ValueKind == JsonValueKind.Object
        && Text(club, "countryFlag") is { } url && url.StartsWith("https://", StringComparison.Ordinal) ? url : null;

    // ---------- Injury history ----------

    /// <summary>The number of the last page of the injury table (1 when it has one page).</summary>
    public static int LastPage(string html) =>
        PagePattern().Matches(html).Select(match => int.Parse(match.Groups[1].Value, CultureInfo.InvariantCulture)).DefaultIfEmpty(1).Max();

    /// <summary>
    /// The lines of the first table of an injury page: season, injury, from, until (empty while the player is still out), days and
    /// games missed. German pages write dates as 31.12.2025, English ones as 31/12/2025 (or "Dec 31, 2025").
    /// </summary>
    public static IReadOnlyList<SportsInjuryRecord> ParseInjuries(string html)
    {
        var start = html.IndexOf("<table class=\"items\">", StringComparison.Ordinal);
        if (start < 0) return [];
        var end = html.IndexOf("</table>", start, StringComparison.Ordinal);
        var table = end < 0 ? html[start..] : html[start..end];
        var list = new List<SportsInjuryRecord>();
        foreach (var row in RowPattern().Split(table).Skip(1))
        {
            var cells = CellPattern().Matches(row).Select(match => match.Groups[1].Value).ToArray();
            if (cells.Length < 6) continue;
            var injury = Plain(cells[1]);
            if (injury.Length == 0) continue;
            list.Add(new SportsInjuryRecord(
                Plain(cells[0]) is { Length: > 0 } season ? season : null,
                char.ToUpper(injury[0], CultureInfo.InvariantCulture) + injury[1..],
                Day(Plain(cells[2])),
                Day(Plain(cells[3])),
                FirstNumber(Plain(cells[4])),
                FirstNumber(SpanPattern().Match(cells[5]) is { Success: true } games ? games.Groups[1].Value : Plain(cells[5]))));
        }

        return list;
    }

    private static readonly string[] DayFormats = ["dd.MM.yyyy", "dd/MM/yyyy", "MMM d, yyyy", "d MMM yyyy"];

    private static DateTimeOffset? Day(string text) =>
        DateTime.TryParseExact(text, DayFormats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var day)
            ? new DateTimeOffset(day.Year, day.Month, day.Day, 0, 0, 0, TimeSpan.Zero)
            : null;

    private static int? FirstNumber(string text) =>
        NumberPattern().Match(text) is { Success: true } match ? int.Parse(match.Value, CultureInfo.InvariantCulture) : null;

    private static string Plain(string html) => WebUtility.HtmlDecode(TagPattern().Replace(html, " ")).Trim();

    /// <summary>"95,00 Mio. €" is a fee, "ablösefrei" free, "Leihe" or "Leihgebühr: 1,50 Mio. €" a loan, "Leih-Ende" its end, "-" and "?" unknown.</summary>
    public static (string Kind, long? Amount) Fee(string text)
    {
        var plain = WebUtility.HtmlDecode(text).Trim();
        if (plain.Contains("Leih-Ende", StringComparison.OrdinalIgnoreCase) || plain.Contains("Leihende", StringComparison.OrdinalIgnoreCase)) return ("loan-end", null);
        if (plain.StartsWith("Leih", StringComparison.OrdinalIgnoreCase)) return ("loan", Euros(plain));
        if (plain.Contains("ablösefrei", StringComparison.OrdinalIgnoreCase)) return ("free", null);
        return Euros(plain) is { } euros ? ("fee", euros) : ("unknown", null);
    }

    /// <summary>"95,00 Mio. €" -> 95 000 000, "700 Tsd. €" -> 700 000, "1,2 Mrd. €" -> 1 200 000 000; text without an amount -> null.</summary>
    public static long? Euros(string text)
    {
        var match = AmountPattern().Match(WebUtility.HtmlDecode(text));
        if (!match.Success || !decimal.TryParse(match.Groups[1].Value.Replace(".", string.Empty, StringComparison.Ordinal), NumberStyles.Number, CultureInfo.GetCultureInfo("de-DE"), out var number)) return null;
        var factor = match.Groups[2].Value switch
        {
            "Mrd." => 1_000_000_000m,
            "Mio." => 1_000_000m,
            "Tsd." => 1_000m,
            _ => 1m,
        };
        return (long)(number * factor);
    }

    private static string? Text(JsonElement element, string property) =>
        element.ValueKind == JsonValueKind.Object && element.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;

    [GeneratedRegex(@"<tr class=""(?:odd|even)"">", RegexOptions.CultureInvariant)]
    private static partial Regex RowPattern();

    [GeneratedRegex(@"<td class=""hauptlink""><a[^>]*href=""/[^""]+/profil/spieler/(\d{1,12})""[^>]*>([^<]+)</a>", RegexOptions.CultureInvariant)]
    private static partial Regex PlayerPattern();

    [GeneratedRegex(@"<a title=""([^""]*)"" href=""/[^""]+/startseite/verein/\d+""", RegexOptions.CultureInvariant)]
    private static partial Regex ClubPattern();

    [GeneratedRegex(@"<td class=""zentriert"">(\d{1,2})</td>", RegexOptions.CultureInvariant)]
    private static partial Regex AgePattern();

    [GeneratedRegex(@"(\d[\d.]*(?:,\d+)?)\s*(Mrd\.|Mio\.|Tsd\.)?\s*€", RegexOptions.CultureInvariant)]
    private static partial Regex AmountPattern();

    [GeneratedRegex(@"<td[^>]*>(.*?)</td>", RegexOptions.CultureInvariant | RegexOptions.Singleline)]
    private static partial Regex CellPattern();

    [GeneratedRegex(@"<span>(\d+)</span>", RegexOptions.CultureInvariant)]
    private static partial Regex SpanPattern();

    [GeneratedRegex(@"<[^>]+>", RegexOptions.CultureInvariant)]
    private static partial Regex TagPattern();

    [GeneratedRegex(@"\d+", RegexOptions.CultureInvariant)]
    private static partial Regex NumberPattern();

    [GeneratedRegex(@"/verletzungen/spieler/\d+/page/(\d+)", RegexOptions.CultureInvariant)]
    private static partial Regex PagePattern();
}
