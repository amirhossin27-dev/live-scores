using System.Globalization;
using System.Text.Json;

namespace Standalone.Api.Services;

/// <summary>The referee of a match with his nationality.</summary>
public sealed record SportsOfficial(string Name, SportsCountry? Country);

/// <summary>What FotMob adds to a match: the line-ups, the referee, the stadium with its country and the ids of the two teams.</summary>
public sealed record FotMobMatchFacts(
    IReadOnlyList<SportsLineup> Lineups,
    SportsOfficial? Referee,
    string? Stadium,
    string? City,
    SportsCountry? StadiumCountry,
    string? HomeTeamId,
    string? AwayTeamId,
    IReadOnlyList<SportsEvent> CoachDismissals);

/// <summary>A side of a match in a team's schedule; <c>Logo</c> is FotMob's crest.</summary>
public sealed record SportsTeamSide(string? Id, string Name, string? Logo, int? Score);

/// <summary>
/// A match of the team's season. <c>Status</c> is <c>scheduled</c>, <c>live</c>, <c>finished</c>, <c>postponed</c> or <c>canceled</c>,
/// <c>Result</c> <c>win</c>, <c>draw</c> or <c>loss</c> seen from the team (finished matches only).
/// </summary>
public sealed record SportsTeamFixture(string Id, DateTimeOffset Start, string Competition, SportsTeamSide Home, SportsTeamSide Away, string Status, string? StatusText, string? Result);

/// <summary>A competition the team has won, with the seasons (newest first) and the seasons it came second.</summary>
public sealed record SportsTrophy(string Competition, int Won, int RunnerUp, IReadOnlyList<string> SeasonsWon, IReadOnlyList<string> SeasonsRunnerUp);

/// <summary>
/// A transfer of the team. <c>Direction</c> is <c>in</c>, <c>out</c> or <c>extension</c> (a new contract); <c>FeeKind</c> is
/// <c>fee</c> (<c>Fee</c> in euros), <c>loan</c> (a loan fee in <c>Fee</c> when there was one), <c>free</c>, <c>undisclosed</c>,
/// <c>extension</c> or <c>unknown</c>; <c>Until</c> is the end of the loan or the contract. <c>FromId</c>/<c>ToId</c> and the
/// logos are FotMob's ids and crests of the two clubs.
/// </summary>
public sealed record SportsTeamTransfer(
    DateTimeOffset Date,
    string Player,
    string? PlayerId,
    SportsText? Position,
    string Direction,
    string? From,
    string? To,
    long? Fee,
    string FeeKind,
    DateTimeOffset? Until,
    long? MarketValue,
    string? FromId = null,
    string? ToId = null,
    string? FromLogo = null,
    string? ToLogo = null);

public sealed record SportsSquadMember(
    string Id,
    string Name,
    string? Shirt,
    SportsCountry? Country,
    int? Age,
    SportsText? Role,
    bool Injured,
    double? Rating,
    int? Goals,
    int? Assists,
    long? MarketValue);

/// <summary>A group of the squad: <c>coach</c>, <c>keepers</c>, <c>defenders</c>, <c>midfielders</c> or <c>attackers</c>.</summary>
public sealed record SportsSquadGroup(string Key, IReadOnlyList<SportsSquadMember> Members);

public sealed record SportsTeamProfile(
    string Id,
    string Name,
    string? Logo,
    SportsCountry? Country,
    string? League,
    string? Season,
    string? Venue,
    string? City,
    int? Capacity,
    string? Coach,
    IReadOnlyList<SportsTeamFixture> Fixtures,
    IReadOnlyList<SportsTrophy> Trophies,
    IReadOnlyList<SportsTeamTransfer> Transfers,
    IReadOnlyList<SportsSquadGroup> Squad);

public sealed record SportsNewsItem(string Id, string Title, string Url, string? Image, string? Source, DateTimeOffset? Published);

public sealed partial class SportsService
{
    /// <summary>FotMob's id of the home or away team of a football match, or null when FotMob does not have the match.</summary>
    public async Task<string?> GetTeamIdAsync(string competition, string id, string side, CancellationToken cancellationToken)
    {
        var match = await GetMatchAsync(competition, id, cancellationToken);
        return side == "away" ? match?.AwayTeamId : match?.HomeTeamId;
    }
}

/// <summary>
/// Team pages from FotMob's public web API (unofficial, no key): the matches of the season, the titles, the transfers, the squad
/// and the news. Read on the server and cached.
/// </summary>
public sealed partial class FotMobService
{
    private static readonly TimeSpan TeamCache = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan NewsCache = TimeSpan.FromMinutes(15);
    private const int NewsCount = 20;

    public static bool IsValidTeamId(string? id) => IsValidPlayerId(id);

    /// <summary>The line-ups, the referee, the stadium and the team ids of the match at FotMob; empty when FotMob does not have it.</summary>
    public async Task<FotMobMatchFacts?> GetMatchFactsAsync(DateTimeOffset start, string home, string away, bool live, CancellationToken cancellationToken)
    {
        var matchId = await FindMatchIdAsync(start, home, away, cancellationToken);
        if (matchId is null) return null;
        var json = await GetCachedAsync($"fotmob:match:{matchId}", $"{Api}/matchDetails?matchId={matchId}", live ? LiveCache : MatchCache, cancellationToken);
        return json is null ? null : ParseMatchFacts(json);
    }

    public async Task<SportsTeamProfile?> GetTeamAsync(string id, CancellationToken cancellationToken)
    {
        var json = await GetCachedAsync($"fotmob:team:{id}", $"{Api}/teams?id={id}&ccode3=DEU", TeamCache, cancellationToken);
        return json is null ? null : ParseTeam(json);
    }

    /// <summary>The newest articles about the team in German or English (FotMob collects them from news sites).</summary>
    public async Task<IReadOnlyList<SportsNewsItem>?> GetTeamNewsAsync(string id, string language, CancellationToken cancellationToken)
    {
        var json = await GetCachedAsync($"fotmob:team-news:{id}:{language}", $"{Api}/tlnews?id={id}&type=team&language={language}&startIndex=0", NewsCache, cancellationToken);
        return json is null ? null : ParseTeamNews(json);
    }

    // ---------- Match facts ----------

    public static FotMobMatchFacts ParseMatchFacts(string json)
    {
        var lineups = ParseLineups(json);
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        string? homeId = null, awayId = null;
        if (TryChild(root, "general", out var general) && general.ValueKind == JsonValueKind.Object)
        {
            homeId = TryChild(general, "homeTeam", out var homeTeam) ? Text(homeTeam, "id") : null;
            awayId = TryChild(general, "awayTeam", out var awayTeam) ? Text(awayTeam, "id") : null;
        }

        SportsOfficial? referee = null;
        string? stadium = null, city = null;
        SportsCountry? country = null;
        TryChild(root, "content", out var content);
        TryChild(content, "matchFacts", out var facts);
        if (TryChild(facts, "infoBox", out var info) && info.ValueKind == JsonValueKind.Object)
        {
            if (TryChild(info, "Referee", out var official) && Text(official, "text") is { } name && !string.IsNullOrWhiteSpace(name))
            {
                referee = new SportsOfficial(name.Trim(), SportsCountries.FromCode(Text(official, "countryCode"), Text(official, "country")));
            }

            if (TryChild(info, "Stadium", out var place) && place.ValueKind == JsonValueKind.Object)
            {
                stadium = Text(place, "name");
                city = Text(place, "city");
                country = SportsCountries.FromName(Text(place, "country"));
            }
        }

        return new FotMobMatchFacts(lineups, referee, stadium, city, country, IsValidTeamId(homeId) ? homeId : null, IsValidTeamId(awayId) ? awayId : null, CoachDismissals(facts, lineups));
    }

    private static IReadOnlyList<SportsEvent> CoachDismissals(JsonElement facts, IReadOnlyList<SportsLineup> lineups)
    {
        if (!TryChild(facts, "events", out var group) || !TryChild(group, "events", out var events) || events.ValueKind != JsonValueKind.Array) return [];
        var cards = new List<SportsEvent>();
        foreach (var item in events.EnumerateArray())
        {
            if (Text(item, "type") != "Card" || Text(item, "card") is not ("Red" or "YellowRed" or "YellowRedCard")) continue;
            if (!TryChild(item, "isHome", out var home) || home.ValueKind is not (JsonValueKind.True or JsonValueKind.False)) continue;
            var side = home.GetBoolean() ? "home" : "away";
            var lineup = lineups.FirstOrDefault(team => team.Side == side);
            TryChild(item, "player", out var person);
            var id = Text(person, "id") ?? Text(item, "playerId");
            var matchesCoach = id is not null && id == lineup?.CoachId;
            TryChild(item, "cardDescription", out var description);
            if (!matchesCoach && Text(description, "localizedKey") != "coach") continue;
            var name = matchesCoach ? lineup!.Coach : Text(person, "name") ?? Text(item, "nameStr");
            var time = Whole(item, "time");
            if (time is null) continue;
            var minute = Whole(item, "overloadTime") is > 0 and var added ? $"{time}'+{added}'" : $"{time}'";
            cards.Add(new SportsEvent(Text(item, "card") == "Red" ? "red" : "yellow-red", minute, side, name, null, IsCoach: true));
        }
        return cards;
    }

    // ---------- Team page ----------

    public static string TeamLogo(string id) => $"https://images.fotmob.com/image_resources/logo/teamlogo/{id}.png";

    public static SportsTeamProfile? ParseTeam(string json)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        if (!TryChild(root, "details", out var details) || Text(details, "id") is not { } id || !IsValidTeamId(id) || Text(details, "name") is not { } name) return null;

        string? venue = null, city = null;
        int? capacity = null;
        string? season = null;
        if (TryChild(root, "overview", out var overview) && overview.ValueKind == JsonValueKind.Object)
        {
            season = Text(overview, "season") is { Length: > 0 } current ? current : null;
            if (TryChild(overview, "venue", out var place) && place.ValueKind == JsonValueKind.Object)
            {
                if (TryChild(place, "widget", out var widget))
                {
                    venue = Text(widget, "name");
                    city = Text(widget, "city");
                }

                if (TryChild(place, "statPairs", out var pairs) && pairs.ValueKind == JsonValueKind.Array)
                {
                    foreach (var pair in pairs.EnumerateArray())
                    {
                        if (pair.ValueKind == JsonValueKind.Array && pair.GetArrayLength() == 2 && pair[0].ValueKind == JsonValueKind.String && pair[0].GetString() == "Capacity"
                            && pair[1].ValueKind == JsonValueKind.Number && pair[1].TryGetInt32(out var seats)) capacity = seats;
                    }
                }
            }
        }

        var squad = Squad(root);
        return new SportsTeamProfile(
            id,
            name.Trim(),
            TeamLogo(id),
            SportsCountries.FromCode(Text(details, "country"), null),
            Text(details, "primaryLeagueName"),
            season ?? Text(details, "latestSeason"),
            venue,
            city,
            capacity,
            squad.FirstOrDefault(group => group.Key == "coach")?.Members.FirstOrDefault()?.Name,
            Fixtures(root, id),
            Trophies(root),
            TeamTransfers(root, id),
            squad);
    }

    private static IReadOnlyList<SportsTeamFixture> Fixtures(JsonElement root, string teamId)
    {
        if (!TryChild(root, "fixtures", out var fixtures) || !TryChild(fixtures, "allFixtures", out var all) || !TryChild(all, "fixtures", out var items) || items.ValueKind != JsonValueKind.Array) return [];
        var list = new List<SportsTeamFixture>();
        foreach (var item in items.EnumerateArray())
        {
            var id = Text(item, "id");
            if (id is null || !TryChild(item, "status", out var status) || UtcText(status) is not { } start) continue;
            var (state, text) = FixtureStatus(status);
            var played = state is "live" or "finished";
            if (FixtureSide(item, "home", played) is not { } home || FixtureSide(item, "away", played) is not { } away) continue;

            string? result = null;
            if (state == "finished")
            {
                // FotMob's "result" is 1/0/-1 seen from the team (penalties included); the score is the fallback
                result = Number(item, "result") switch
                {
                    > 0 => "win",
                    < 0 => "loss",
                    0 => "draw",
                    _ => home.Score is { } homeScore && away.Score is { } awayScore
                        ? (homeScore == awayScore ? "draw" : (homeScore > awayScore) == (home.Id == teamId) ? "win" : "loss")
                        : null,
                };
            }

            var competition = TryChild(item, "tournament", out var tournament) ? Text(tournament, "name") : null;
            list.Add(new SportsTeamFixture(id, start, competition ?? string.Empty, home, away, state, text, result));
        }

        return list.OrderBy(fixture => fixture.Start).ToArray();
    }

    private static SportsTeamSide? FixtureSide(JsonElement item, string property, bool played)
    {
        if (!TryChild(item, property, out var side) || Text(side, "name") is not { } name) return null;
        var id = Text(side, "id");
        var valid = IsValidTeamId(id);
        return new SportsTeamSide(valid ? id : null, name.Trim(), valid ? TeamLogo(id!) : null, played ? Whole(side, "score") : null);
    }

    private static (string Status, string? Text) FixtureStatus(JsonElement status)
    {
        var reason = TryChild(status, "reason", out var why) && why.ValueKind == JsonValueKind.Object ? why : default;
        var key = Text(reason, "longKey") ?? string.Empty;
        if (TryChild(status, "cancelled", out var cancelled) && cancelled.ValueKind == JsonValueKind.True) return ("canceled", null);
        if (key.Contains("postponed", StringComparison.OrdinalIgnoreCase) || key.Contains("abandoned", StringComparison.OrdinalIgnoreCase)) return ("postponed", null);
        if (TryChild(status, "finished", out var finished) && finished.ValueKind == JsonValueKind.True) return ("finished", Text(reason, "short"));
        if (TryChild(status, "started", out var started) && started.ValueKind == JsonValueKind.True)
        {
            var minute = TryChild(status, "liveTime", out var live) ? Text(live, "short") : null;
            // FotMob writes the minute with direction marks and a typographic apostrophe ("‎1‎’")
            return ("live", minute?.Replace("‎", string.Empty, StringComparison.Ordinal).Replace('’', '\'').Trim());
        }

        return ("scheduled", null);
    }

    private static DateTimeOffset? UtcText(JsonElement status) =>
        DateTimeOffset.TryParse(Text(status, "utcTime"), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var start) ? start : null;

    private static IReadOnlyList<SportsTrophy> Trophies(JsonElement root)
    {
        if (!TryChild(root, "history", out var history) || !TryChild(history, "trophyList", out var trophies) || trophies.ValueKind != JsonValueKind.Array) return [];
        var list = new List<SportsTrophy>();
        foreach (var trophy in trophies.EnumerateArray())
        {
            var name = Text(trophy, "name");
            var won = Seasons(trophy, "seasonsWon");
            if (string.IsNullOrWhiteSpace(name) || won.Count == 0 && Seasons(trophy, "seasonsRunnerup").Count == 0) continue;
            list.Add(new SportsTrophy(name.Trim(), Whole(trophy, "won") ?? won.Count, Whole(trophy, "runnerup") ?? 0, won, Seasons(trophy, "seasonsRunnerup")));
        }

        // the competitions with the most titles first, as on a club's trophy cabinet
        return list.OrderByDescending(trophy => trophy.Won).ToArray();
    }

    private static IReadOnlyList<string> Seasons(JsonElement trophy, string property)
    {
        var text = Text(trophy, property);
        return string.IsNullOrWhiteSpace(text)
            ? []
            : text.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Distinct(StringComparer.Ordinal).OrderByDescending(season => season, StringComparer.Ordinal).ToArray();
    }

    private static IReadOnlyList<SportsTeamTransfer> TeamTransfers(JsonElement root, string teamId)
    {
        if (!TryChild(root, "transfers", out var transfers) || !TryChild(transfers, "allTransfers", out var items) || items.ValueKind != JsonValueKind.Array) return [];
        var ownId = Text(transfers, "ourTeamId") ?? teamId;
        var list = new List<SportsTeamTransfer>();
        foreach (var item in items.EnumerateArray())
        {
            var player = Text(item, "name");
            if (string.IsNullOrWhiteSpace(player) || LocalDate(Text(item, "transferDate")) is not { } date) continue;
            var extension = TryChild(item, "contractExtension", out var renewed) && renewed.ValueKind == JsonValueKind.True;
            var loan = TryChild(item, "onLoan", out var onLoan) && onLoan.ValueKind == JsonValueKind.True;
            var direction = extension ? "extension" : Text(item, "toClubId") == ownId ? "in" : "out";

            var fee = TryChild(item, "fee", out var feeElement) && feeElement.ValueKind == JsonValueKind.Object ? feeElement : default;
            var amount = Number(fee, "value") is { } euros and > 0 ? (long?)euros : null;
            var feeKind = extension ? "extension"
                : amount is not null ? (loan ? "loan" : "fee")
                : Text(fee, "feeText") switch
                {
                    "free transfer" => "free",
                    "on loan" => "loan",
                    "undisclosed" => "undisclosed",
                    _ => loan ? "loan" : "unknown",
                };

            SportsText? position = TryChild(item, "position", out var place) && Text(place, "label") is { } label ? new SportsText(Text(place, "key"), label) : null;
            var marketValue = Number(item, "marketValue") is { } value and > 0 ? (long?)value : null;
            var fromId = IsValidTeamId(Text(item, "fromClubId")) ? Text(item, "fromClubId") : null;
            var toId = IsValidTeamId(Text(item, "toClubId")) ? Text(item, "toClubId") : null;
            list.Add(new SportsTeamTransfer(
                date,
                player.Trim(),
                IsValidPlayerId(Text(item, "playerId")) ? Text(item, "playerId") : null,
                position,
                direction,
                Text(item, "fromClub"),
                Text(item, "toClub"),
                amount,
                feeKind,
                loan || extension ? LocalDate(Text(item, "toDate")) : null,
                marketValue,
                fromId,
                toId,
                fromId is null ? null : TeamLogo(fromId),
                toId is null ? null : TeamLogo(toId)));
        }

        return list.OrderByDescending(transfer => transfer.Date).ToArray();
    }

    private static readonly string[] SquadGroups = ["coach", "keepers", "defenders", "midfielders", "attackers"];

    private static IReadOnlyList<SportsSquadGroup> Squad(JsonElement root)
    {
        if (!TryChild(root, "squad", out var squad) || !TryChild(squad, "squad", out var groups) || groups.ValueKind != JsonValueKind.Array) return [];
        var list = new List<SportsSquadGroup>();
        foreach (var group in groups.EnumerateArray())
        {
            var key = Text(group, "title");
            if (key is null || !SquadGroups.Contains(key) || !TryChild(group, "members", out var members) || members.ValueKind != JsonValueKind.Array) continue;
            var people = new List<SportsSquadMember>();
            foreach (var member in members.EnumerateArray())
            {
                var id = Text(member, "id");
                var name = Text(member, "name");
                if (!IsValidPlayerId(id) || string.IsNullOrWhiteSpace(name)) continue;
                SportsText? role = TryChild(member, "role", out var job) && Text(job, "fallback") is { } fallback ? new SportsText(Text(job, "key"), fallback) : null;
                var rating = Number(member, "rating") is { } score and > 0 ? Math.Round(score, 1) : (double?)null;
                var marketValue = Number(member, "transferValue") is { } value and > 0 ? (long?)value : null;
                people.Add(new SportsSquadMember(
                    id!,
                    name.Trim(),
                    Text(member, "shirtNumber"),
                    SportsCountries.FromCode(Text(member, "ccode"), Text(member, "cname")),
                    Whole(member, "age"),
                    role,
                    TryChild(member, "injured", out var injured) && injured.ValueKind == JsonValueKind.True,
                    rating,
                    key == "coach" ? null : Whole(member, "goals"),
                    key == "coach" ? null : Whole(member, "assists"),
                    marketValue));
            }

            if (people.Count > 0) list.Add(new SportsSquadGroup(key, people));
        }

        return list.OrderBy(group => Array.IndexOf(SquadGroups, group.Key)).ToArray();
    }

    // ---------- News ----------

    /// <summary>Only https articles and pictures are passed on; FotMob's own placeholder pictures are left out.</summary>
    public static IReadOnlyList<SportsNewsItem> ParseTeamNews(string json)
    {
        using var document = JsonDocument.Parse(json);
        if (!TryChild(document.RootElement, "data", out var items) || items.ValueKind != JsonValueKind.Array) return [];
        var list = new List<SportsNewsItem>();
        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var item in items.EnumerateArray())
        {
            var title = Text(item, "title");
            var url = TryChild(item, "page", out var page) ? Text(page, "url") : null;
            if (string.IsNullOrWhiteSpace(title) || !IsHttps(url) || !seen.Add(url!)) continue;
            var image = Text(item, "imageUrl");
            list.Add(new SportsNewsItem(
                Text(item, "id") ?? url!,
                title.Trim(),
                url!,
                IsHttps(image) ? image : null,
                Text(item, "sourceStr"),
                LocalDate(Text(item, "gmtTime"))));
            if (list.Count == NewsCount) break;
        }

        return list;
    }

    /// <summary>A property that is there and not null; FotMob sends <c>null</c> for whole parts (a national team has no transfers).</summary>
    private static bool TryChild(JsonElement element, string name, out JsonElement child)
    {
        child = default;
        return element.ValueKind == JsonValueKind.Object && element.TryGetProperty(name, out child) && child.ValueKind != JsonValueKind.Null;
    }

    private static bool IsHttps(string? value) => Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps;
}
