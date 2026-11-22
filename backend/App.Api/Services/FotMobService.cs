using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Caching.Memory;

namespace Standalone.Api.Services;

/// <summary>A key of the source (for the translation in the browser) with the English text of the source as fallback.</summary>
public sealed record SportsText(string? Key, string Text);

public sealed record SportsPlayerMatch(
    string Id,
    DateTimeOffset Date,
    string Competition,
    string Opponent,
    bool Home,
    int? HomeScore,
    int? AwayScore,
    int? Minutes,
    int Goals,
    int Assists,
    int YellowCards,
    int RedCards,
    double? Rating,
    bool OnBench,
    string? OpponentId = null,
    string? OpponentLogo = null);

/// <summary>
/// A club (or national team) of a career; <c>Transfer</c> is how the player came (free transfer, loan, ...), when the source knows.
/// <c>TeamId</c> and <c>Logo</c> are FotMob's id and crest of the team.
/// </summary>
public sealed record SportsCareerEntry(string Team, string Kind, DateTimeOffset? Start, DateTimeOffset? End, bool Active, int? Appearances, int? Goals, int? Assists, SportsText? Transfer, string? TeamId = null, string? Logo = null);

/// <summary>A club a coach managed: the time and, when the source has them, the matches with wins, draws, losses and points per game.</summary>
public sealed record SportsCoachStint(string Team, string? TeamId, string? Logo, DateTimeOffset? Start, DateTimeOffset? End, bool Active, int? Matches, int? Wins, int? Draws, int? Losses, double? PointsPerGame);

/// <summary>A title of a person: <c>Role</c> is <c>coach</c> or <c>player</c>, with the team it was won with.</summary>
public sealed record SportsPersonTrophy(string Role, string Team, string? TeamId, string? Logo, string Competition, IReadOnlyList<string> SeasonsWon, IReadOnlyList<string> SeasonsRunnerUp);

/// <summary>A past (or the running) injury from Transfermarkt; <c>Until</c> is null while the player is still out.</summary>
public sealed record SportsInjuryRecord(string? Season, string Injury, DateTimeOffset? From, DateTimeOffset? Until, int? Days, int? GamesMissed);

/// <summary>
/// A move between two clubs. <c>FeeKind</c> is <c>fee</c> (with <c>Fee</c> in euros), <c>free</c>, <c>loan</c> (a loan fee in
/// <c>Fee</c> when there was one), <c>loan-end</c> or <c>unknown</c>; <c>MarketValue</c> is the player's value at that time.
/// Moves derived from FotMob's career have no fee (<c>FeeKind</c> null).
/// </summary>
public sealed record SportsTransfer(DateTimeOffset Date, string? From, string To, SportsText? Type, long? Fee = null, string? FeeKind = null, long? MarketValue = null, string? FromLogo = null, string? ToLogo = null, string? Season = null, string? FromFlag = null, string? ToFlag = null, string? DetailUrl = null);

/// <summary>The current injury from FotMob (the history comes from Transfermarkt).</summary>
public sealed record SportsInjury(SportsText Status, string? ExpectedReturn, DateTimeOffset? Updated);

public sealed record SportsSeasonStat(string Key, string Title, string Value);

public sealed record SportsPlayerProfile(
    string Id,
    string Name,
    string? Team,
    SportsText? Position,
    string? Country,
    string? CountryCode,
    DateTimeOffset? BirthDate,
    int? Age,
    int? HeightCm,
    SportsText? Foot,
    string? Shirt,
    long? MarketValue,
    DateTimeOffset? ContractEnd,
    SportsInjury? Injury,
    string? SeasonLeague,
    string? Season,
    IReadOnlyList<SportsSeasonStat> SeasonStats,
    IReadOnlyList<SportsPlayerMatch> RecentMatches,
    IReadOnlyList<SportsCareerEntry> Career,
    IReadOnlyList<SportsTransfer> Transfers,
    string TransfersSource = "fotmob",
    bool IsCoach = false,
    IReadOnlyList<SportsCoachStint>? CoachCareer = null,
    IReadOnlyList<SportsPersonTrophy>? Trophies = null,
    IReadOnlyList<SportsInjuryRecord>? InjuryHistory = null,
    IReadOnlyList<SportsPlayerSeason>? Seasons = null,
    string? SeasonEntry = null,
    IReadOnlyList<SportsCareerSeason>? CareerSeasons = null);

/// <summary>
/// Football details ESPN does not have, from FotMob's public web API (unofficial, no key): line-ups with the positions on the pitch
/// and the match ratings of the players, and player profiles (recent matches, career, transfers, current injury). A match of
/// ESPN is found at FotMob by its kick-off time and the names of the two teams. Everything is read on the server and cached.
/// </summary>
public sealed partial class FotMobService(HttpClient http, IMemoryCache cache, TransfermarktService? transfermarkt = null)
{
    private const string Api = "https://www.fotmob.com/api/data";
    private static readonly TimeSpan ListCache = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan LiveCache = TimeSpan.FromSeconds(30);
    private static readonly TimeSpan MatchCache = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan PlayerCache = TimeSpan.FromHours(6);
    private static readonly TimeSpan FailureCache = TimeSpan.FromMinutes(1);
    private static readonly TimeSpan KickOffTolerance = TimeSpan.FromMinutes(20);

    public const int RecentMatchCount = 10;

    public static bool IsValidPlayerId(string? id) => !string.IsNullOrEmpty(id) && IdPattern().IsMatch(id);

    /// <summary>The line-ups of the match at FotMob, or none when FotMob does not have it (yet) or does not answer.</summary>
    public async Task<IReadOnlyList<SportsLineup>> GetLineupsAsync(DateTimeOffset start, string home, string away, bool live, CancellationToken cancellationToken)
    {
        var matchId = await FindMatchIdAsync(start, home, away, cancellationToken);
        if (matchId is null) return [];
        var json = await GetCachedAsync($"fotmob:match:{matchId}", $"{Api}/matchDetails?matchId={matchId}", live ? LiveCache : MatchCache, cancellationToken);
        return json is null ? [] : ParseLineups(json);
    }

    public Task<SportsPlayerProfile?> GetPlayerAsync(string id, CancellationToken cancellationToken) => GetPlayerAsync(id, "de", cancellationToken);

    /// <summary>
    /// The profile from FotMob (a coach's too); for a player the transfers with their fees and the injury history (names of the
    /// injuries in <paramref name="language"/>) from Transfermarkt when the player is found there.
    /// </summary>
    public async Task<SportsPlayerProfile?> GetPlayerAsync(string id, string language, CancellationToken cancellationToken)
    {
        var json = await GetCachedAsync($"fotmob:player:{id}", $"{Api}/playerData?id={id}", PlayerCache, cancellationToken);
        var profile = json is null ? null : ParsePlayer(json);
        if (profile is null || transfermarkt is null || profile.IsCoach) return profile;
        var transfers = await transfermarkt.GetTransfersAsync(profile.Name, profile.Team, profile.Age, cancellationToken);
        var injuries = await transfermarkt.GetInjuriesAsync(profile.Name, profile.Team, profile.Age, language, cancellationToken);
        var withFees = transfers.Count > 0 ? profile with { Transfers = transfers, TransfersSource = "transfermarkt" } : profile;
        return withFees with { InjuryHistory = injuries };
    }

    private async Task<string?> FindMatchIdAsync(DateTimeOffset start, string home, string away, CancellationToken cancellationToken)
    {
        // FotMob's day lists are cut by its own clock: the day of the kick-off in UTC first, then the days around it.
        var day = start.UtcDateTime.Date;
        foreach (var date in new[] { day, day.AddDays(1), day.AddDays(-1) })
        {
            var code = date.ToString("yyyyMMdd", CultureInfo.InvariantCulture);
            var json = await GetCachedAsync($"fotmob:day:{code}", $"{Api}/matches?date={code}", ListCache, cancellationToken);
            if (json is null) continue;
            var found = FindMatch(ParseMatchList(json), start, home, away);
            if (found is not null) return found;
        }

        return null;
    }

    private async Task<string?> GetCachedAsync(string key, string url, TimeSpan lifetime, CancellationToken cancellationToken) =>
        await cache.GetOrCreateAsync(key, async entry =>
        {
            try
            {
                HttpResponseMessage response;
                try
                {
                    response = await http.GetAsync(url, cancellationToken);
                }
                catch (HttpRequestException exception) when (exception.StatusCode is null)
                {
                    System.Diagnostics.Trace.TraceWarning("Data source request failed: {0}", exception.GetType().Name);
                    // FotMob now and then drops a new connection during the TLS handshake: one more try before giving up
                    response = await http.GetAsync(url, cancellationToken);
                }

                using var answer = response;
                answer.EnsureSuccessStatusCode();
                var body = await answer.Content.ReadAsStringAsync(cancellationToken);
                using (JsonDocument.Parse(body)) { }
                entry.AbsoluteExpirationRelativeToNow = lifetime;
                return body;
            }
            catch (Exception exception) when (exception is HttpRequestException or JsonException or TaskCanceledException && !cancellationToken.IsCancellationRequested)
            {
                System.Diagnostics.Trace.TraceWarning("Data source request failed: {0}", exception.GetType().Name);
                entry.AbsoluteExpirationRelativeToNow = FailureCache;
                return null;
            }
        });

    // ---------- Finding a match ----------

    public sealed record ListedMatch(string Id, DateTimeOffset Start, IReadOnlyList<string> Home, IReadOnlyList<string> Away);

    public static IReadOnlyList<ListedMatch> ParseMatchList(string json)
    {
        using var document = JsonDocument.Parse(json);
        var matches = new List<ListedMatch>();
        if (!document.RootElement.TryGetProperty("leagues", out var leagues) || leagues.ValueKind != JsonValueKind.Array) return matches;
        foreach (var league in leagues.EnumerateArray())
        {
            if (!league.TryGetProperty("matches", out var items) || items.ValueKind != JsonValueKind.Array) continue;
            foreach (var item in items.EnumerateArray())
            {
                var id = Text(item, "id");
                var utc = item.TryGetProperty("status", out var status) ? Text(status, "utcTime") : null;
                if (id is null || !DateTimeOffset.TryParse(utc, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var start)) continue;
                matches.Add(new ListedMatch(id, start, Names(item, "home"), Names(item, "away")));
            }
        }

        return matches;
    }

    private static IReadOnlyList<string> Names(JsonElement item, string side) =>
        item.TryGetProperty(side, out var team) ? new[] { Text(team, "name"), Text(team, "longName"), Text(team, "shortName") }.OfType<string>().ToArray() : [];

    /// <summary>
    /// The match with the same kick-off (20 minutes either way) whose team names fit best. Both names fitting beats one; when
    /// only one name fits and two matches fit that well, nothing is taken rather than a wrong match.
    /// </summary>
    public static string? FindMatch(IReadOnlyList<ListedMatch> matches, DateTimeOffset start, string home, string away)
    {
        var homeWords = Words(home);
        var awayWords = Words(away);
        var scored = matches
            .Where(match => (match.Start - start).Duration() <= KickOffTolerance)
            .Select(match => (match.Id, Score: (Fits(homeWords, match.Home) ? 1 : 0) + (Fits(awayWords, match.Away) ? 1 : 0)))
            .Where(item => item.Score > 0)
            .OrderByDescending(item => item.Score)
            .ToList();
        if (scored.Count == 0) return null;
        if (scored.Count > 1 && scored[1].Score == scored[0].Score) return null;
        return scored[0].Id;
    }

    private static bool Fits(HashSet<string> words, IReadOnlyList<string> names) => names.Any(name => Words(name).Overlaps(words));

    // ESPN writes English names, FotMob the local ones; the words that every club has ("FC", "1.", "Borussia") say nothing.
    private static readonly HashSet<string> CommonWords = new(StringComparer.Ordinal)
    {
        "fc", "sc", "sv", "vfl", "vfb", "tsg", "tsv", "ssv", "fsv", "bsc", "bv", "spvgg", "ac", "as", "ss", "us", "cf", "cd", "ud", "sd", "rc", "rcd",
        "afc", "cfc", "club", "de", "del", "la", "le", "the", "borussia", "real", "united", "city", "town", "sporting", "athletic", "atletico", "olympique",
    };

    private static readonly Dictionary<string, string> EnglishNames = new(StringComparer.Ordinal)
    {
        ["munich"] = "munchen", ["cologne"] = "koln", ["nuremberg"] = "nurnberg", ["milan"] = "milano", ["rome"] = "roma", ["lisbon"] = "lisboa",
        ["turin"] = "torino", ["seville"] = "sevilla", ["vienna"] = "wien", ["zurich"] = "zurich", ["prague"] = "praha", ["moenchengladbach"] = "monchengladbach",
        ["gladbach"] = "monchengladbach", ["mgladbach"] = "monchengladbach", ["inter"] = "internazionale",
    };

    /// <summary>A name without accents, in lower case, in single words ("Saïd El Mala" -> "said el mala").</summary>
    internal static string Plain(string name)
    {
        var plain = new StringBuilder();
        foreach (var letter in name.Replace("ß", "ss", StringComparison.Ordinal).Normalize(NormalizationForm.FormD))
        {
            if (CharUnicodeInfo.GetUnicodeCategory(letter) == UnicodeCategory.NonSpacingMark || letter == '\'') continue;
            // letters with a stroke have no accent to drop ("Lillestrøm", "Jagiełło")
            plain.Append(char.ToLowerInvariant(letter) switch
            {
                'ø' => "o",
                'ł' => "l",
                'đ' => "d",
                'æ' => "ae",
                'œ' => "oe",
                'ı' => "i",
                var lower when char.IsLetterOrDigit(lower) => lower.ToString(),
                _ => " ",
            });
        }

        return string.Join(' ', plain.ToString().Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }

    /// <summary>The words of a club name that tell it apart (English city names in their local form).</summary>
    internal static HashSet<string> Words(string name)
    {
        return Plain(name)
            .Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Where(word => word.Length >= 3 && !word.All(char.IsDigit) && !CommonWords.Contains(word))
            .Select(word => EnglishNames.GetValueOrDefault(word, word))
            .ToHashSet(StringComparer.Ordinal);
    }

    // ---------- Line-ups ----------

    public static IReadOnlyList<SportsLineup> ParseLineups(string json)
    {
        using var document = JsonDocument.Parse(json);
        if (!document.RootElement.TryGetProperty("content", out var content) || !content.TryGetProperty("lineup", out var lineup) || lineup.ValueKind != JsonValueKind.Object) return [];

        var lineups = new List<SportsLineup>();
        foreach (var (property, side) in new[] { ("homeTeam", "home"), ("awayTeam", "away") })
        {
            if (!lineup.TryGetProperty(property, out var team) || team.ValueKind != JsonValueKind.Object) continue;
            var starters = Players(team, "starters", withPlace: true);
            if (starters.Count == 0) continue;
            var coach = team.TryGetProperty("coach", out var trainer) ? Text(trainer, "name") : null;
            var coachId = coach is not null ? Text(trainer, "id") : null;
            lineups.Add(new SportsLineup(side, Text(team, "formation"), starters, Players(team, "subs", withPlace: false), "fotmob", coach, IsValidPlayerId(coachId) ? coachId : null));
        }

        // Half a line-up is no line-up: the graphic needs both teams.
        return lineups.Count == 2 ? lineups : [];
    }

    private static IReadOnlyList<SportsPlayer> Players(JsonElement team, string property, bool withPlace)
    {
        if (!team.TryGetProperty(property, out var players) || players.ValueKind != JsonValueKind.Array) return [];
        var list = new List<SportsPlayer>();
        foreach (var player in players.EnumerateArray())
        {
            var name = Text(player, "name");
            if (string.IsNullOrWhiteSpace(name)) continue;
            double? x = null, y = null;
            if (withPlace)
            {
                var layout = player.TryGetProperty("verticalLayout", out var place) ? place : default;
                x = Number(layout, "x");
                y = Number(layout, "y");
                if (x is null || y is null) continue;
            }

            double? rating = null;
            int? subIn = null, subOut = null;
            if (player.TryGetProperty("performance", out var performance) && performance.ValueKind == JsonValueKind.Object)
            {
                rating = Number(performance, "rating");
                if (performance.TryGetProperty("substitutionEvents", out var changes) && changes.ValueKind == JsonValueKind.Array)
                {
                    foreach (var change in changes.EnumerateArray())
                    {
                        var minute = Number(change, "time") is { } time ? (int?)(int)time : null;
                        if (Text(change, "type") == "subIn") subIn = minute;
                        else if (Text(change, "type") == "subOut") subOut = minute;
                    }
                }
            }

            var captain = player.TryGetProperty("isCaptain", out var isCaptain) && isCaptain.ValueKind == JsonValueKind.True;
            list.Add(new SportsPlayer(name.Trim(), Text(player, "shirtNumber"), null, x, y, rating is > 0 ? Math.Round(rating.Value, 1) : null, Text(player, "id"), subIn, subOut, captain, SportsCountries.FromCode(Text(player, "countryCode"), Text(player, "countryName"))));
        }

        return list;
    }

    // ---------- Player profile ----------

    public static SportsPlayerProfile? ParsePlayer(string json)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        var id = Text(root, "id");
        var name = Text(root, "name");
        if (id is null || string.IsNullOrWhiteSpace(name)) return null;

        string? country = null, countryCode = null, shirt = null;
        int? age = null, height = null;
        long? marketValue = null;
        SportsText? foot = null;
        if (root.TryGetProperty("playerInformation", out var information) && information.ValueKind == JsonValueKind.Array)
        {
            foreach (var fact in information.EnumerateArray())
            {
                if (!fact.TryGetProperty("value", out var value)) continue;
                switch (Text(fact, "translationKey"))
                {
                    case "height_sentencecase": height = Number(value, "numberValue") is { } cm ? (int)cm : null; break;
                    case "shirt": shirt = Number(value, "numberValue") is { } number ? ((int)number).ToString(CultureInfo.InvariantCulture) : null; break;
                    case "age_sentencecase": age = Number(value, "numberValue") is { } years ? (int)years : null; break;
                    case "preferred_foot": foot = Text(value, "fallback") is { } footText ? new SportsText(Text(value, "key"), footText) : null; break;
                    case "country_sentencecase": country = Text(value, "fallback"); countryCode = Text(fact, "countryCode"); break;
                    case "transfer_value": marketValue = Number(value, "numberValue") is { } euros ? (long)euros : null; break;
                }
            }
        }

        SportsText? position = null;
        if (root.TryGetProperty("positionDescription", out var description) && description.TryGetProperty("primaryPosition", out var primary) && Text(primary, "label") is { } label)
        {
            position = new SportsText(Text(primary, "key"), label);
        }

        SportsInjury? injury = null;
        if (root.TryGetProperty("injuryInformation", out var hurt) && hurt.ValueKind == JsonValueKind.Object && Text(hurt, "name") is { } injuryName)
        {
            var expected = hurt.TryGetProperty("expectedReturn", out var back) ? Text(back, "expectedReturnFallback") : null;
            injury = new SportsInjury(new SportsText(Text(hurt, "key"), injuryName), expected, UtcTime(hurt, "lastUpdated"));
        }

        string? seasonLeague = null, season = null;
        var seasonStats = new List<SportsSeasonStat>();
        if (root.TryGetProperty("mainLeague", out var main) && main.ValueKind == JsonValueKind.Object)
        {
            seasonLeague = Text(main, "leagueName");
            season = Text(main, "season");
            if (main.TryGetProperty("stats", out var stats) && stats.ValueKind == JsonValueKind.Array)
            {
                foreach (var stat in stats.EnumerateArray())
                {
                    var title = Text(stat, "title");
                    var value = stat.TryGetProperty("value", out var raw) ? raw.ValueKind switch
                    {
                        JsonValueKind.Number => raw.GetDouble().ToString("0.##", CultureInfo.InvariantCulture),
                        JsonValueKind.String => raw.GetString(),
                        _ => null,
                    } : null;
                    if (title is not null && value is not null) seasonStats.Add(new SportsSeasonStat(Text(stat, "localizedTitleId") ?? title, title, value));
                }
            }
        }

        CompletePlayerSeasonCounts(seasonStats, root, season, Text(main, "leagueId"));
        var team = root.TryGetProperty("primaryTeam", out var primaryTeam) ? Text(primaryTeam, "teamName") : null;
        var career = Career(root);
        var isCoach = root.TryGetProperty("isCoach", out var coach) && coach.ValueKind == JsonValueKind.True;
        var (seasons, seasonEntry) = StatSeasons(root);
        return new SportsPlayerProfile(
            id,
            name.Trim(),
            team,
            position,
            country,
            countryCode,
            UtcTime(root, "birthDate"),
            age,
            height,
            foot,
            shirt,
            marketValue,
            UtcTime(root, "contractEnd"),
            injury,
            seasonLeague,
            season,
            seasonStats,
            RecentMatches(root),
            career,
            Transfers(career),
            IsCoach: isCoach,
            CoachCareer: CoachCareer(root),
            Trophies: PersonTrophies(root),
            Seasons: seasons,
            SeasonEntry: seasonEntry,
            CareerSeasons: CareerSeasons(root));
    }

    private static IReadOnlyList<SportsPlayerMatch> RecentMatches(JsonElement root, string property = "recentMatches", int limit = RecentMatchCount)
    {
        if (!root.TryGetProperty(property, out var matches) || matches.ValueKind != JsonValueKind.Array) return [];
        var list = new List<SportsPlayerMatch>();
        foreach (var match in matches.EnumerateArray())
        {
            var id = Text(match, "id");
            var date = UtcTime(match, "matchDate");
            if (id is null || date is null) continue;
            var rating = match.TryGetProperty("ratingProps", out var props) && double.TryParse(Text(props, "rating"), NumberStyles.Float, CultureInfo.InvariantCulture, out var value) && value > 0 ? value : (double?)null;
            list.Add(new SportsPlayerMatch(
                id,
                date.Value,
                Text(match, "leagueName") ?? string.Empty,
                Text(match, "opponentTeamName") ?? string.Empty,
                match.TryGetProperty("isHomeTeam", out var home) && home.ValueKind == JsonValueKind.True,
                Whole(match, "homeScore"),
                Whole(match, "awayScore"),
                Whole(match, "minutesPlayed"),
                Whole(match, "goals") ?? 0,
                Whole(match, "assists") ?? 0,
                Whole(match, "yellowCards") ?? 0,
                Whole(match, "redCards") ?? 0,
                rating,
                match.TryGetProperty("onBench", out var bench) && bench.ValueKind == JsonValueKind.True,
                IsValidPlayerId(Text(match, "opponentTeamId")) ? Text(match, "opponentTeamId") : null,
                IsValidPlayerId(Text(match, "opponentTeamId")) ? TeamLogo(Text(match, "opponentTeamId")!) : null));
            if (list.Count == limit) break;
        }

        return list;
    }

    private static IReadOnlyList<SportsCareerEntry> Career(JsonElement root)
    {
        if (!root.TryGetProperty("careerHistory", out var history) || !history.TryGetProperty("careerItems", out var items) || items.ValueKind != JsonValueKind.Object) return [];
        var list = new List<SportsCareerEntry>();
        foreach (var (property, kind) in new[] { ("senior", "club"), ("national team", "national") })
        {
            if (!items.TryGetProperty(property, out var group) || !group.TryGetProperty("teamEntries", out var entries) || entries.ValueKind != JsonValueKind.Array) continue;
            foreach (var entry in entries.EnumerateArray())
            {
                var team = Text(entry, "team");
                if (string.IsNullOrWhiteSpace(team)) continue;
                SportsText? transfer = null;
                if (entry.TryGetProperty("transferType", out var type) && type.ValueKind == JsonValueKind.Object && Text(type, "text") is { } typeText)
                {
                    transfer = new SportsText(Text(type, "localizationKey"), typeText);
                }

                var teamId = IsValidPlayerId(Text(entry, "teamId")) ? Text(entry, "teamId") : null;
                list.Add(new SportsCareerEntry(
                    team,
                    kind,
                    LocalDate(Text(entry, "startDate")),
                    LocalDate(Text(entry, "endDate")),
                    entry.TryGetProperty("active", out var active) && active.ValueKind == JsonValueKind.True,
                    WholeText(entry, "appearances"),
                    WholeText(entry, "goals"),
                    WholeText(entry, "assists"),
                    transfer,
                    teamId,
                    teamId is null ? null : TeamLogo(teamId)));
            }
        }

        return list;
    }

    /// <summary>The moves between the clubs of the career, newest first (the source has no fees).</summary>
    private static IReadOnlyList<SportsTransfer> Transfers(IReadOnlyList<SportsCareerEntry> career)
    {
        var clubs = career.Where(entry => entry.Kind == "club" && entry.Start is not null).OrderBy(entry => entry.Start).ToList();
        var moves = new List<SportsTransfer>();
        for (var index = 0; index < clubs.Count; index++)
        {
            var previous = index > 0 ? clubs[index - 1] : null;
            if (previous?.Team == clubs[index].Team) continue;
            moves.Add(new SportsTransfer(clubs[index].Start!.Value, previous?.Team, clubs[index].Team, clubs[index].Transfer, FromLogo: previous?.Logo, ToLogo: clubs[index].Logo));
        }

        moves.Reverse();
        return moves;
    }

    /// <summary>
    /// The clubs a coach managed, newest first: FotMob's coach statistics (matches, wins, draws, losses, points per game) with the
    /// dates of the coach career; a club of the career without statistics keeps its dates only. Empty for a player.
    /// </summary>
    private static IReadOnlyList<SportsCoachStint> CoachCareer(JsonElement root)
    {
        var entries = root.TryGetProperty("careerHistory", out var history) && history.TryGetProperty("careerItems", out var items) && items.ValueKind == JsonValueKind.Object
            && items.TryGetProperty("coach", out var coach) && coach.ValueKind == JsonValueKind.Object && coach.TryGetProperty("teamEntries", out var list) && list.ValueKind == JsonValueKind.Array
            ? list.EnumerateArray().ToArray()
            : [];
        var stats = new List<JsonElement>();
        if (root.TryGetProperty("coachStats", out var coachStats) && coachStats.ValueKind == JsonValueKind.Object)
        {
            if (coachStats.TryGetProperty("activeCareerEntry", out var current) && current.ValueKind == JsonValueKind.Object) stats.Add(current);
            if (coachStats.TryGetProperty("historicalCareerEntries", out var past) && past.ValueKind == JsonValueKind.Array) stats.AddRange(past.EnumerateArray());
        }

        var stints = new List<SportsCoachStint>();
        var used = new HashSet<int>();
        foreach (var entry in entries)
        {
            var team = Text(entry, "team");
            if (string.IsNullOrWhiteSpace(team)) continue;
            var teamId = IsValidPlayerId(Text(entry, "teamId")) ? Text(entry, "teamId") : null;
            var active = entry.TryGetProperty("active", out var running) && running.ValueKind == JsonValueKind.True;
            var start = LocalDate(Text(entry, "startDate"));
            // the statistics of the same club: the running one for the running stint, else the one that starts on the same day
            var free = Enumerable.Range(0, stats.Count).Where(at => !used.Contains(at) && Text(stats[at], "teamId") == teamId).ToArray();
            var index = free.Where(at => active ? UtcTime(stats[at], "endDate") is null : UtcTime(stats[at], "startDate")?.Date == start?.Date).DefaultIfEmpty(free.Length > 0 ? free[0] : -1).First();
            JsonElement? stat = index >= 0 ? stats[index] : null;
            if (index >= 0) used.Add(index);
            stints.Add(new SportsCoachStint(
                team.Trim(),
                teamId,
                teamId is null ? null : TeamLogo(teamId),
                start,
                LocalDate(Text(entry, "endDate")),
                active,
                stat is { } some ? Whole(some, "matches") : null,
                stat is { } wins ? Whole(wins, "wins") : null,
                stat is { } draws ? Whole(draws, "draws") : null,
                stat is { } losses ? Whole(losses, "losses") : null,
                stat is { } points && Number(points, "pointsPerGame") is { } perGame ? Math.Round(perGame, 2) : PointsPerGame(stat)));
        }

        return stints.OrderByDescending(stint => stint.Active).ThenByDescending(stint => stint.Start ?? DateTimeOffset.MinValue).ToArray();
    }

    /// <summary>The running stint has no points per game at FotMob: worked out from wins and draws.</summary>
    private static double? PointsPerGame(JsonElement? stat) =>
        stat is { } some && Whole(some, "matches") is { } matches and > 0 && Whole(some, "wins") is { } wins && Whole(some, "draws") is { } draws
            ? Math.Round((wins * 3 + draws) / (double)matches, 2)
            : null;

    /// <summary>The titles of a person as coach and as player, per team; FotMob's pre-season tournaments (league id -1) are left out.</summary>
    private static IReadOnlyList<SportsPersonTrophy> PersonTrophies(JsonElement root)
    {
        if (!root.TryGetProperty("trophies", out var trophies) || trophies.ValueKind != JsonValueKind.Object) return [];
        var list = new List<SportsPersonTrophy>();
        foreach (var (property, role) in new[] { ("coachTrophies", "coach"), ("playerTrophies", "player") })
        {
            if (!trophies.TryGetProperty(property, out var teams) || teams.ValueKind != JsonValueKind.Array) continue;
            foreach (var team in teams.EnumerateArray())
            {
                var name = Text(team, "teamName");
                if (string.IsNullOrWhiteSpace(name) || !team.TryGetProperty("tournaments", out var tournaments) || tournaments.ValueKind != JsonValueKind.Array) continue;
                var teamId = IsValidPlayerId(Text(team, "teamId")) ? Text(team, "teamId") : null;
                foreach (var tournament in tournaments.EnumerateArray())
                {
                    var competition = Text(tournament, "leagueName");
                    if (string.IsNullOrWhiteSpace(competition) || Text(tournament, "leagueId") == "-1") continue;
                    var won = Strings(tournament, "seasonsWon");
                    var second = Strings(tournament, "seasonsRunnerUp");
                    if (won.Count == 0 && second.Count == 0) continue;
                    list.Add(new SportsPersonTrophy(role, name.Trim(), teamId, teamId is null ? null : TeamLogo(teamId), competition.Trim(), won, second));
                }
            }
        }

        return list;
    }

    private static IReadOnlyList<string> Strings(JsonElement element, string property) =>
        element.TryGetProperty(property, out var values) && values.ValueKind == JsonValueKind.Array
            ? values.EnumerateArray().Where(value => value.ValueKind == JsonValueKind.String).Select(value => value.GetString()!).ToArray()
            : [];

    private static DateTimeOffset? LocalDate(string? value) =>
        DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var date) ? date : null;

    private static DateTimeOffset? UtcTime(JsonElement element, string property) =>
        element.TryGetProperty(property, out var time) && time.ValueKind == JsonValueKind.Object ? LocalDate(Text(time, "utcTime")) : null;

    private static int? Whole(JsonElement element, string property) => Number(element, property) is { } value ? (int)value : null;

    private static int? WholeText(JsonElement element, string property) =>
        int.TryParse(Text(element, property), NumberStyles.Integer, CultureInfo.InvariantCulture, out var value) ? value : null;

    private static double? Number(JsonElement element, string property)
    {
        if (element.ValueKind != JsonValueKind.Object || !element.TryGetProperty(property, out var value)) return null;
        if (value.ValueKind == JsonValueKind.Number) return value.GetDouble();
        return value.ValueKind == JsonValueKind.String && double.TryParse(value.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed) ? parsed : null;
    }

    private static string? Text(JsonElement element, string property)
    {
        if (element.ValueKind != JsonValueKind.Object || !element.TryGetProperty(property, out var value)) return null;
        return value.ValueKind switch
        {
            JsonValueKind.String => value.GetString(),
            JsonValueKind.Number => value.GetRawText(),
            _ => null,
        };
    }

    [GeneratedRegex(@"^\d{1,12}$", RegexOptions.CultureInvariant)]
    private static partial Regex IdPattern();
}
