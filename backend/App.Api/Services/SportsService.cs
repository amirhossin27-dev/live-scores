using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Caching.Memory;

namespace Standalone.Api.Services;

/// <summary>
/// One side of a match: a team, a fighter or the winner of a race. <c>Score</c> is text because some sports have no number.
/// Football in the scores: <c>RedCards</c> and <c>YellowRedCards</c> (second yellow) of the team, null elsewhere.
/// </summary>
public sealed record SportsSide(string Name, string? ShortName, string? Logo, string? Score, bool? Winner, int? RedCards = null, int? YellowRedCards = null);

/// <summary>
/// One line of the live results. <c>Status</c> is <c>scheduled</c>, <c>live</c>, <c>finished</c>, <c>postponed</c> or <c>canceled</c>;
/// <c>StatusText</c> is what the source shows next to the score ("67'", "HT", "FT", "Q3 5:23", "Round 2"). A race weekend is one line
/// (<c>Title</c> = the Grand Prix, <c>Detail</c> = the current session), a fight card is one line per fight.
/// </summary>
public sealed record SportsMatch(string Id, DateTimeOffset Start, string Status, string StatusText, string? Title, SportsSide? Home, SportsSide? Away, string? Detail);

public sealed record SportsCompetitionScores(string Id, string Name, IReadOnlyList<SportsMatch> Matches);

/// <summary><c>Failed</c> lists the competitions the source did not answer for; the others are complete.</summary>
public sealed record SportsScores(string Date, IReadOnlyList<SportsCompetitionScores> Competitions, IReadOnlyList<string> Failed);

/// <summary>One figure of a match for both sides, as text ("69.6", "19/34", "30:40"). <c>Key</c> is ESPN's name, <c>Label</c> its English label.</summary>
public sealed record SportsStat(string Key, string Label, string Home, string Away);

/// <summary>
/// A moment of a football match. <c>Kind</c> is <c>goal</c>, <c>penalty</c>, <c>own-goal</c>, <c>yellow</c>, <c>yellow-red</c> (second
/// yellow), <c>red</c> or <c>substitution</c>;
/// <c>Player</c> is the scorer, the booked player or the player coming on, <c>Other</c> the assist or the player going off.
/// </summary>
public sealed record SportsEvent(string Kind, string Minute, string Side, string? Player, string? Other);

/// <summary>
/// A player of a line-up. <c>X</c>/<c>Y</c> place a starter on his half of the pitch (0..1, seen from his own goal: <c>Y</c> 0.1 is
/// the keeper, 0.9 the strikers; <c>X</c> 0 is the team's right flank). <c>Rating</c> is the match rating (FotMob, 0-10),
/// <c>ProfileId</c> the FotMob id for the player profile, <c>SubIn</c>/<c>SubOut</c> the minutes of a substitution.
/// </summary>
public sealed record SportsPlayer(
    string Name,
    string? Jersey,
    string? Position,
    double? X = null,
    double? Y = null,
    double? Rating = null,
    string? ProfileId = null,
    int? SubIn = null,
    int? SubOut = null,
    bool Captain = false,
    SportsCountry? Country = null);

/// <summary><c>Source</c> is <c>fotmob</c> (positions and ratings) or <c>espn</c> (positions worked out from the formation, no ratings).</summary>
public sealed record SportsLineup(string Side, string? Formation, IReadOnlyList<SportsPlayer> Starters, IReadOnlyList<SportsPlayer> Bench, string Source = "espn", string? Coach = null, string? CoachId = null);

/// <summary>
/// The details of one match: <c>Periods</c> are the scores per half/quarter/period/inning of both sides (empty when the
/// source has none), <c>Stats</c> the team statistics in the order of the source, <c>Events</c> goals, cards and changes
/// (football only), <c>Lineups</c> the line-ups once they are announced, <c>Broadcasts</c> the TV channels ESPN names (mostly US).
/// From FotMob (football): <c>Referee</c> with his nationality, the country of the stadium and the team ids for the team pages.
/// </summary>
public sealed record SportsMatchDetails(
    string Id,
    string Competition,
    DateTimeOffset Start,
    string Status,
    string StatusText,
    SportsSide Home,
    SportsSide Away,
    IReadOnlyList<string> HomePeriods,
    IReadOnlyList<string> AwayPeriods,
    string? Venue,
    string? City,
    int? Attendance,
    IReadOnlyList<SportsStat> Stats,
    IReadOnlyList<SportsEvent> Events,
    IReadOnlyList<SportsLineup> Lineups,
    IReadOnlyList<string>? Broadcasts = null,
    SportsOfficial? Referee = null,
    SportsCountry? VenueCountry = null,
    string? HomeTeamId = null,
    string? AwayTeamId = null);

/// <summary>
/// Live results of football leagues and cups, other team sports, Formula 1 and MMA from ESPN's public scoreboards (no key).
/// The API reads them on the server and caches them, so that all browsers together cause a few requests per minute.
/// </summary>
public sealed partial class SportsService(HttpClient http, IMemoryCache cache, FotMobService? fotMob = null, TransfermarktService? transfermarkt = null)
{
    public const int MaxCompetitions = 40;

    private static readonly TimeSpan LiveCache = TimeSpan.FromSeconds(30);
    private static readonly TimeSpan TodayCache = TimeSpan.FromMinutes(2);
    private static readonly TimeSpan OtherDayCache = TimeSpan.FromMinutes(30);
    private static readonly TimeSpan FailureCache = TimeSpan.FromMinutes(1);

    private static readonly string[] TeamSports = ["soccer", "basketball", "football", "hockey", "baseball"];

    public static bool IsValidCompetition(string? id) => !string.IsNullOrEmpty(id) && CompetitionPattern().IsMatch(id);

    public static bool TryParseDate(string? value, out DateOnly date)
    {
        date = default;
        return !string.IsNullOrEmpty(value) && value.Length == 8 && DateOnly.TryParseExact(value, "yyyyMMdd", CultureInfo.InvariantCulture, DateTimeStyles.None, out date);
    }

    public async Task<SportsScores> GetScoresAsync(IEnumerable<string> competitions, string date, CancellationToken cancellationToken)
    {
        var ids = competitions.Distinct(StringComparer.Ordinal).Take(MaxCompetitions).ToArray();
        using var gate = new SemaphoreSlim(6);
        var results = await Task.WhenAll(ids.Select(async id =>
        {
            await gate.WaitAsync(cancellationToken);
            try
            {
                return (Id: id, Result: await GetCompetitionAsync(id, date, cancellationToken));
            }
            finally
            {
                gate.Release();
            }
        }));

        return new SportsScores(
            date,
            results.Where(item => item.Result is not null).Select(item => item.Result!).ToArray(),
            results.Where(item => item.Result is null).Select(item => item.Id).ToArray());
    }

    private async Task<SportsCompetitionScores?> GetCompetitionAsync(string id, string date, CancellationToken cancellationToken)
    {
        return await cache.GetOrCreateAsync($"sports:{id}:{date}", async entry =>
        {
            try
            {
                using var response = await http.GetAsync($"https://site.api.espn.com/apis/site/v2/sports/{id}/scoreboard?dates={date}", cancellationToken);
                response.EnsureSuccessStatusCode();
                var parsed = ParseScoreboard(id, await response.Content.ReadAsStringAsync(cancellationToken));
                var live = parsed.Matches.Any(match => match.Status == "live");
                var today = TryParseDate(date, out var day) && Math.Abs(day.DayNumber - DateOnly.FromDateTime(DateTime.UtcNow).DayNumber) <= 1;
                entry.AbsoluteExpirationRelativeToNow = live ? LiveCache : today ? TodayCache : OtherDayCache;
                return parsed;
            }
            catch (Exception exception) when (exception is HttpRequestException or JsonException or InvalidOperationException or TaskCanceledException && !cancellationToken.IsCancellationRequested)
            {
                System.Diagnostics.Trace.TraceWarning("Data source request failed: {0}", exception.GetType().Name);
                entry.AbsoluteExpirationRelativeToNow = FailureCache;
                return null;
            }
        });
    }

    public static bool IsTeamSport(string competition) => TeamSports.Contains(competition.Split('/')[0]);

    public static bool IsValidMatchId(string? id) => !string.IsNullOrEmpty(id) && MatchIdPattern().IsMatch(id);

    /// <summary>
    /// The details of one match of a team sport (ESPN's summary), cached like the scoreboards; null when the source does not answer.
    /// For football the line-ups come from FotMob when it has the match (positions on the pitch and ratings); otherwise ESPN's stay.
    /// </summary>
    public async Task<SportsMatchDetails?> GetMatchAsync(string competition, string id, CancellationToken cancellationToken)
    {
        return await cache.GetOrCreateAsync($"sports:match:{competition}:{id}", async entry =>
        {
            try
            {
                using var response = await http.GetAsync($"https://site.api.espn.com/apis/site/v2/sports/{competition}/summary?event={id}", cancellationToken);
                response.EnsureSuccessStatusCode();
                var details = ParseSummary(competition, await response.Content.ReadAsStringAsync(cancellationToken));
                if (details is not null && fotMob is not null && competition.StartsWith("soccer/", StringComparison.Ordinal))
                {
                    var facts = await fotMob.GetMatchFactsAsync(details.Start, details.Home.Name, details.Away.Name, details.Status == "live", cancellationToken);
                    if (facts is not null)
                    {
                        // FotMob writes the stadium and the city in the local language and knows the referee's nationality
                        details = details with
                        {
                            Lineups = facts.Lineups.Count > 0 ? facts.Lineups : details.Lineups,
                            Referee = facts.Referee ?? details.Referee,
                            Venue = facts.Stadium ?? details.Venue,
                            City = facts.Stadium is not null ? facts.City : details.City,
                            VenueCountry = facts.StadiumCountry,
                            HomeTeamId = facts.HomeTeamId,
                            AwayTeamId = facts.AwayTeamId,
                        };
                    }
                }

                entry.AbsoluteExpirationRelativeToNow = details is null ? FailureCache : details.Status == "live" ? LiveCache : details.Status == "finished" ? OtherDayCache : TodayCache;
                return details;
            }
            catch (Exception exception) when (exception is HttpRequestException or JsonException or InvalidOperationException or TaskCanceledException && !cancellationToken.IsCancellationRequested)
            {
                System.Diagnostics.Trace.TraceWarning("Data source request failed: {0}", exception.GetType().Name);
                entry.AbsoluteExpirationRelativeToNow = FailureCache;
                return null;
            }
        });
    }

    // ---------- Parsing (static, so that it can be tested without a network) ----------

    public static SportsMatchDetails? ParseSummary(string competition, string json)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        if (!root.TryGetProperty("header", out var header) || FirstCompetition(header) is not { } match) return null;
        if (!match.TryGetProperty("competitors", out var competitors) || competitors.ValueKind != JsonValueKind.Array) return null;

        JsonElement? homeElement = null;
        JsonElement? awayElement = null;
        foreach (var competitor in competitors.EnumerateArray())
        {
            if (Text(competitor, "homeAway") == "away") awayElement = competitor;
            else homeElement ??= competitor;
        }

        if (homeElement is not { } homeCompetitor || awayElement is not { } awayCompetitor || Side(homeCompetitor) is not { } home || Side(awayCompetitor) is not { } away) return null;
        var homeId = TeamId(homeCompetitor);
        var awayId = TeamId(awayCompetitor);
        string SideOf(JsonElement element)
        {
            var teamId = TeamId(element);
            return teamId is not null && teamId == awayId ? "away" : teamId is not null && teamId == homeId ? "home" : Text(element, "homeAway") ?? "home";
        }

        var (status, statusText) = Status(match.TryGetProperty("status", out var matchStatus) ? matchStatus : default);
        var competitionName = header.TryGetProperty("league", out var league) ? Text(league, "name") ?? competition : competition;

        string? venue = null, city = null;
        int? attendance = null;
        SportsOfficial? referee = null;
        if (root.TryGetProperty("gameInfo", out var gameInfo) && gameInfo.ValueKind == JsonValueKind.Object)
        {
            if (gameInfo.TryGetProperty("venue", out var place) && place.ValueKind == JsonValueKind.Object)
            {
                venue = Text(place, "fullName") ?? Text(place, "shortName");
                city = place.TryGetProperty("address", out var address) ? Text(address, "city") : null;
            }

            // ESPN sends 0 when it does not know the attendance
            if (gameInfo.TryGetProperty("attendance", out var people) && people.ValueKind == JsonValueKind.Number && people.TryGetInt32(out var count) && count > 0) attendance = count;

            // ESPN names the officials without nationality; FotMob's referee replaces this one for football
            if (gameInfo.TryGetProperty("officials", out var officials) && officials.ValueKind == JsonValueKind.Array)
            {
                var list = officials.EnumerateArray().ToList();
                var main = list.FirstOrDefault(item => item.TryGetProperty("position", out var role) && Text(role, "name") is "Referee" or "Referee (R)");
                if (main.ValueKind != JsonValueKind.Object && list.Count > 0) main = list[0];
                if (main.ValueKind == JsonValueKind.Object && (Text(main, "displayName") ?? Text(main, "fullName")) is { Length: > 0 } name) referee = new SportsOfficial(name.Trim(), null);
            }
        }

        var events = Events(root, SideOf);
        return new SportsMatchDetails(
            Text(match, "id") ?? Text(header, "id") ?? string.Empty,
            competitionName,
            Start(header, match),
            status,
            statusText,
            home,
            away,
            Periods(homeCompetitor),
            Periods(awayCompetitor),
            venue,
            city,
            attendance,
            Stats(root, homeId, awayId),
            events,
            WithSubstitutions(Lineups(root, SideOf), events),
            Broadcasts(root, match),
            referee);
    }

    /// <summary>The channels of ESPN's broadcasts ("NFL Net", "ESPN"), from the match first, then from the summary; each name once.</summary>
    private static IReadOnlyList<string> Broadcasts(JsonElement root, JsonElement match)
    {
        var names = new List<string>();
        foreach (var list in new[] { match, root })
        {
            if (!list.TryGetProperty("broadcasts", out var broadcasts) || broadcasts.ValueKind != JsonValueKind.Array) continue;
            foreach (var broadcast in broadcasts.EnumerateArray())
            {
                if (broadcast.TryGetProperty("media", out var media) && Text(media, "shortName") is { } name) names.Add(name);
                if (broadcast.TryGetProperty("names", out var several) && several.ValueKind == JsonValueKind.Array)
                {
                    names.AddRange(several.EnumerateArray().Where(item => item.ValueKind == JsonValueKind.String).Select(item => item.GetString()!));
                }
            }
        }

        return names.Select(name => name.Trim()).Where(name => name.Length > 0).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
    }

    private static string? TeamId(JsonElement element) =>
        element.TryGetProperty("team", out var team) && team.ValueKind == JsonValueKind.Object ? Text(team, "id") : Text(element, "id");

    private static IReadOnlyList<string> Periods(JsonElement competitor) =>
        competitor.TryGetProperty("linescores", out var lines) && lines.ValueKind == JsonValueKind.Array
            ? lines.EnumerateArray().Select(line => Text(line, "displayValue") ?? string.Empty).ToArray()
            : [];

    /// <summary>The statistics both teams have, in the order of the home team; repeated keys (the NFL sends interceptions twice) only once.</summary>
    private static IReadOnlyList<SportsStat> Stats(JsonElement root, string? homeId, string? awayId)
    {
        if (!root.TryGetProperty("boxscore", out var boxscore) || !boxscore.TryGetProperty("teams", out var teams) || teams.ValueKind != JsonValueKind.Array) return [];

        Dictionary<string, (string Label, string Value)>? homeStats = null, awayStats = null;
        List<string> order = [];
        foreach (var team in teams.EnumerateArray())
        {
            if (!team.TryGetProperty("statistics", out var statistics) || statistics.ValueKind != JsonValueKind.Array) continue;
            var values = new Dictionary<string, (string Label, string Value)>(StringComparer.Ordinal);
            foreach (var stat in statistics.EnumerateArray())
            {
                var key = Text(stat, "name");
                var value = Text(stat, "displayValue");
                if (key is null || value is null || values.ContainsKey(key)) continue;
                values[key] = (Text(stat, "label") ?? key, value);
            }

            var id = TeamId(team);
            var isAway = id is not null ? id == awayId : Text(team, "homeAway") == "away";
            if (isAway) awayStats ??= values;
            else if (homeStats is null) { homeStats = values; order = statistics.EnumerateArray().Select(stat => Text(stat, "name")).OfType<string>().Distinct().ToList(); }
        }

        if (homeStats is null || awayStats is null) return [];
        return order.Where(awayStats.ContainsKey).Select(key => new SportsStat(key, homeStats[key].Label, homeStats[key].Value, awayStats[key].Value)).ToArray();
    }

    private static IReadOnlyList<SportsEvent> Events(JsonElement root, Func<JsonElement, string> sideOf)
    {
        if (!root.TryGetProperty("keyEvents", out var keyEvents) || keyEvents.ValueKind != JsonValueKind.Array) return [];

        var events = new List<SportsEvent>();
        foreach (var item in keyEvents.EnumerateArray())
        {
            var type = item.TryGetProperty("type", out var typeElement) ? Text(typeElement, "type") ?? string.Empty : string.Empty;
            var kind = type switch
            {
                _ when type.Contains("own-goal", StringComparison.Ordinal) => "own-goal",
                _ when type.StartsWith("penalty", StringComparison.Ordinal) && type.Contains("scored", StringComparison.Ordinal) => "penalty",
                _ when type.StartsWith("goal", StringComparison.Ordinal) => "goal",
                _ when type.Contains("yellow-red", StringComparison.Ordinal) => "yellow-red",
                _ when type.Contains("red-card", StringComparison.Ordinal) => "red",
                _ when type.Contains("yellow-card", StringComparison.Ordinal) => "yellow",
                _ when type == "substitution" => "substitution",
                _ => null,
            };
            // goals of a penalty shoot-out are not part of the match's moments
            if (kind is null || item.TryGetProperty("shootout", out var shootout) && shootout.ValueKind == JsonValueKind.True) continue;
            if (!item.TryGetProperty("team", out var team) || team.ValueKind != JsonValueKind.Object) continue;

            var people = item.TryGetProperty("participants", out var participants) && participants.ValueKind == JsonValueKind.Array
                ? participants.EnumerateArray().Select(participant => participant.TryGetProperty("athlete", out var athlete) ? Text(athlete, "displayName") : null).ToArray()
                : [];
            var minute = item.TryGetProperty("clock", out var clock) ? Text(clock, "displayValue") ?? string.Empty : string.Empty;
            var side = sideOf(team);
            var player = people.ElementAtOrDefault(0);
            // ESPN files a second yellow as a red card: the player was booked before
            if (kind == "red" && player is not null && events.Any(moment => moment.Kind == "yellow" && moment.Side == side && moment.Player == player)) kind = "yellow-red";
            events.Add(new SportsEvent(kind, minute, side, player, people.ElementAtOrDefault(1)));
        }

        return events;
    }

    private static IReadOnlyList<SportsLineup> Lineups(JsonElement root, Func<JsonElement, string> sideOf)
    {
        if (!root.TryGetProperty("rosters", out var rosters) || rosters.ValueKind != JsonValueKind.Array) return [];

        var lineups = new List<SportsLineup>();
        foreach (var roster in rosters.EnumerateArray())
        {
            if (!roster.TryGetProperty("roster", out var players) || players.ValueKind != JsonValueKind.Array) continue;
            var starters = new List<(SportsPlayer Player, int Place)>();
            var bench = new List<SportsPlayer>();
            foreach (var player in players.EnumerateArray())
            {
                var name = player.TryGetProperty("athlete", out var athlete) ? Text(athlete, "displayName") : null;
                if (string.IsNullOrWhiteSpace(name)) continue;
                var position = player.TryGetProperty("position", out var place) ? Text(place, "abbreviation") : null;
                var nationality = Text(athlete, "citizenship") ?? (athlete.TryGetProperty("country", out var country) ? Text(country, "displayName") : null);
                var entry = new SportsPlayer(name, Text(player, "jersey"), position, Country: SportsCountries.FromName(nationality));
                var formationPlace = player.TryGetProperty("formationPlace", out var placeValue) && placeValue.ValueKind == JsonValueKind.Number ? placeValue.GetInt32() : 99;
                if (player.TryGetProperty("starter", out var starter) && starter.ValueKind == JsonValueKind.True) starters.Add((entry, formationPlace));
                else bench.Add(entry);
            }

            if (starters.Count == 0) continue;
            var side = Text(roster, "homeAway") ?? (roster.TryGetProperty("team", out var team) ? sideOf(team) : "home");
            var formation = Text(roster, "formation");
            lineups.Add(new SportsLineup(side, formation, PlaceOnPitch(starters, formation), bench));
        }

        return lineups;
    }

    /// <summary>
    /// ESPN gives no coordinates: the keeper goes to the goal, the outfield players are sorted from defence to attack by their
    /// position and cut into the rows of the formation ("4-2-3-1"), each row from the right flank to the left.
    /// </summary>
    public static IReadOnlyList<SportsPlayer> PlaceOnPitch(IReadOnlyList<(SportsPlayer Player, int Place)> starters, string? formation)
    {
        var keeper = starters.FirstOrDefault(item => Depth(item.Player.Position) == 0);
        var outfield = starters.Where(item => !ReferenceEquals(item.Player, keeper.Player)).OrderBy(item => Depth(item.Player.Position)).ThenBy(item => item.Place).ToList();
        var sizes = (formation ?? string.Empty).Split('-').Select(part => int.TryParse(part, out var size) ? size : 0).ToList();
        if (sizes.Count == 0 || sizes.Any(size => size <= 0) || sizes.Sum() != outfield.Count)
        {
            sizes = outfield.GroupBy(item => Depth(item.Player.Position)).Select(group => group.Count()).ToList();
        }

        var placed = new List<SportsPlayer>();
        if (keeper.Player is not null) placed.Add(keeper.Player with { X = 0.5, Y = 0.1 });
        var index = 0;
        for (var row = 0; row < sizes.Count; row++)
        {
            var line = outfield.Skip(index).Take(sizes[row]).OrderBy(item => Flank(item.Player.Position)).ThenBy(item => item.Place).ToList();
            index += sizes[row];
            var y = sizes.Count == 1 ? 0.6 : 0.3 + row * (0.6 / (sizes.Count - 1));
            for (var spot = 0; spot < line.Count; spot++)
            {
                placed.Add(line[spot].Player with { X = Math.Round((spot + 0.5) / line.Count, 3), Y = Math.Round(y, 3) });
            }
        }

        return placed;
    }

    private static int Depth(string? position)
    {
        var code = (position ?? string.Empty).ToUpperInvariant();
        var basic = code.Split('-')[0];
        return basic switch
        {
            "G" or "GK" => 0,
            "RB" or "LB" or "CB" or "CD" or "D" or "RWB" or "LWB" or "SW" => 1,
            "DM" or "CDM" => 2,
            "CM" or "M" or "LM" or "RM" => 3,
            "AM" or "CAM" => 4,
            _ => 5,
        };
    }

    // 0 = right wing, 1 = right of centre, 2 = centre, 3 = left of centre, 4 = left wing (X grows from the team's right to its left)
    private static int Flank(string? position)
    {
        var code = (position ?? string.Empty).ToUpperInvariant();
        if (code is "RB" or "RWB" or "RM" or "RW" or "RF") return 0;
        if (code is "LB" or "LWB" or "LM" or "LW" or "LF") return 4;
        if (code.EndsWith("-R", StringComparison.Ordinal)) return 1;
        if (code.EndsWith("-L", StringComparison.Ordinal)) return 3;
        return 2;
    }

    /// <summary>The minutes of the substitutions of the timeline, written onto the players of the line-ups.</summary>
    private static IReadOnlyList<SportsLineup> WithSubstitutions(IReadOnlyList<SportsLineup> lineups, IReadOnlyList<SportsEvent> events)
    {
        var subs = events.Where(item => item.Kind == "substitution").ToList();
        if (subs.Count == 0) return lineups;
        SportsPlayer Mark(SportsPlayer player, string side)
        {
            var on = subs.FirstOrDefault(item => item.Side == side && item.Player == player.Name);
            var off = subs.FirstOrDefault(item => item.Side == side && item.Other == player.Name);
            return player with { SubIn = on is null ? player.SubIn : MinuteOf(on.Minute), SubOut = off is null ? player.SubOut : MinuteOf(off.Minute) };
        }

        return lineups.Select(lineup => lineup with
        {
            Starters = lineup.Starters.Select(player => Mark(player, lineup.Side)).ToArray(),
            Bench = lineup.Bench.Select(player => Mark(player, lineup.Side)).ToArray(),
        }).ToArray();
    }

    /// <summary>"62'" is 62, "90'+3'" is 90.</summary>
    public static int? MinuteOf(string minute)
    {
        var digits = new string(minute.TakeWhile(char.IsDigit).ToArray());
        return int.TryParse(digits, out var value) ? value : null;
    }

    public static SportsCompetitionScores ParseScoreboard(string id, string json)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        var name = root.TryGetProperty("leagues", out var leagues) && leagues.ValueKind == JsonValueKind.Array && leagues.GetArrayLength() > 0
            ? Text(leagues[0], "name") ?? id
            : id;

        var matches = new List<SportsMatch>();
        if (root.TryGetProperty("events", out var events) && events.ValueKind == JsonValueKind.Array)
        {
            var sport = id.Split('/')[0];
            foreach (var item in events.EnumerateArray())
            {
                if (sport == "racing") AddRace(matches, item);
                else if (sport == "mma") AddFights(matches, item);
                else if (TeamSports.Contains(sport)) AddMatch(matches, item);
            }
        }

        return new SportsCompetitionScores(id, name, matches.OrderBy(match => match.Start).ToArray());
    }

    private static void AddMatch(List<SportsMatch> matches, JsonElement item)
    {
        var competition = FirstCompetition(item);
        if (competition is null || !competition.Value.TryGetProperty("competitors", out var competitors) || competitors.ValueKind != JsonValueKind.Array) return;

        SportsSide? home = null;
        SportsSide? away = null;
        string? homeId = null, awayId = null;
        foreach (var competitor in competitors.EnumerateArray())
        {
            var side = Side(competitor);
            if (side is null) continue;
            if (Text(competitor, "homeAway") == "away") { away = side; awayId = TeamId(competitor); }
            else if (home is null) { home = side; homeId = TeamId(competitor); }
        }

        if (home is null || away is null) return;
        if (competition.Value.TryGetProperty("details", out var details) && details.ValueKind == JsonValueKind.Array)
        {
            home = WithCards(home, homeId, details);
            away = WithCards(away, awayId, details);
        }

        var (status, text) = Status(competition.Value.TryGetProperty("status", out var competitionStatus) ? competitionStatus : item.TryGetProperty("status", out var eventStatus) ? eventStatus : default);
        var note = competition.Value.TryGetProperty("notes", out var notes) && notes.ValueKind == JsonValueKind.Array && notes.GetArrayLength() > 0 ? Text(notes[0], "headline") : null;
        matches.Add(new SportsMatch(Text(item, "id") ?? string.Empty, Start(item, competition.Value), status, text, null, home, away, note));
    }

    /// <summary>
    /// The sending-offs of a team from the moments of ESPN's scoreboard (football): a red card of a player who was booked
    /// before is a second yellow (ESPN files both as "Red Card").
    /// </summary>
    private static SportsSide WithCards(SportsSide side, string? teamId, JsonElement details)
    {
        if (teamId is null) return side;
        var booked = new HashSet<string>(StringComparer.Ordinal);
        int red = 0, yellowRed = 0;
        foreach (var detail in details.EnumerateArray())
        {
            if (!detail.TryGetProperty("team", out var team) || Text(team, "id") != teamId) continue;
            var player = detail.TryGetProperty("athletesInvolved", out var athletes) && athletes.ValueKind == JsonValueKind.Array && athletes.GetArrayLength() > 0
                ? Text(athletes[0], "id") ?? Text(athletes[0], "displayName")
                : null;
            if (detail.TryGetProperty("redCard", out var redCard) && redCard.ValueKind == JsonValueKind.True)
            {
                if (player is not null && booked.Contains(player)) yellowRed++;
                else red++;
            }
            else if (detail.TryGetProperty("yellowCard", out var yellowCard) && yellowCard.ValueKind == JsonValueKind.True && player is not null)
            {
                booked.Add(player);
            }
        }

        return side with { RedCards = red, YellowRedCards = yellowRed };
    }

    /// <summary>A race weekend is one line: the session that is running (or the race), and the winner once the race is over.</summary>
    private static void AddRace(List<SportsMatch> matches, JsonElement item)
    {
        if (!item.TryGetProperty("competitions", out var sessions) || sessions.ValueKind != JsonValueKind.Array || sessions.GetArrayLength() == 0) return;

        JsonElement? chosen = null;
        foreach (var session in sessions.EnumerateArray())
        {
            var state = StateOf(session);
            if (state == "in") { chosen = session; break; }
            if (state == "pre" && chosen is null) chosen = session;
        }

        var raceOver = StateOf(sessions[sessions.GetArrayLength() - 1]) == "post";
        var current = raceOver ? sessions[sessions.GetArrayLength() - 1] : chosen ?? sessions[sessions.GetArrayLength() - 1];
        var (status, text) = Status(current.TryGetProperty("status", out var currentStatus) ? currentStatus : default);

        SportsSide? winner = null;
        if (raceOver && current.TryGetProperty("competitors", out var drivers) && drivers.ValueKind == JsonValueKind.Array)
        {
            foreach (var driver in drivers.EnumerateArray())
            {
                if (driver.TryGetProperty("winner", out var won) && won.ValueKind == JsonValueKind.True) { winner = Side(driver); break; }
            }
        }

        var session2 = current.TryGetProperty("type", out var type) ? Text(type, "abbreviation") ?? Text(type, "text") : null;
        matches.Add(new SportsMatch(Text(item, "id") ?? string.Empty, Start(item, current), status, text, Text(item, "name") ?? Text(item, "shortName"), winner, null, session2));
    }

    /// <summary>A fight card is one line per fight, the main event first; very long cards are cut after six fights.</summary>
    private static void AddFights(List<SportsMatch> matches, JsonElement item)
    {
        if (!item.TryGetProperty("competitions", out var fights) || fights.ValueKind != JsonValueKind.Array) return;

        var eventName = Text(item, "name") ?? Text(item, "shortName");
        var list = fights.EnumerateArray().Reverse().Take(6);
        foreach (var fight in list)
        {
            if (!fight.TryGetProperty("competitors", out var fighters) || fighters.ValueKind != JsonValueKind.Array) continue;
            var sides = fighters.EnumerateArray().Select(Side).Where(side => side is not null).Select(side => side!).ToArray();
            if (sides.Length != 2) continue;
            var (status, text) = Status(fight.TryGetProperty("status", out var fightStatus) ? fightStatus : default);
            var weightClass = fight.TryGetProperty("type", out var type) ? Text(type, "text") ?? Text(type, "abbreviation") : null;
            matches.Add(new SportsMatch(Text(fight, "id") ?? string.Empty, Start(item, fight), status, text, weightClass, sides[0], sides[1], eventName));
        }
    }

    private static JsonElement? FirstCompetition(JsonElement item) =>
        item.TryGetProperty("competitions", out var competitions) && competitions.ValueKind == JsonValueKind.Array && competitions.GetArrayLength() > 0 ? competitions[0] : null;

    private static string StateOf(JsonElement competition) =>
        competition.TryGetProperty("status", out var status) && status.TryGetProperty("type", out var type) ? Text(type, "state") ?? string.Empty : string.Empty;

    private static DateTimeOffset Start(JsonElement item, JsonElement competition) =>
        DateTimeOffset.TryParse(Text(competition, "date") ?? Text(competition, "startDate") ?? Text(item, "date"), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var start) ? start : DateTimeOffset.MinValue;

    private static (string Status, string Text) Status(JsonElement status)
    {
        if (status.ValueKind != JsonValueKind.Object || !status.TryGetProperty("type", out var type)) return ("scheduled", string.Empty);

        var state = Text(type, "state");
        var name = Text(type, "name") ?? string.Empty;
        var shortDetail = Text(type, "shortDetail") ?? Text(type, "detail") ?? string.Empty;
        var clock = Text(status, "displayClock");

        if (name.Contains("POSTPONED", StringComparison.Ordinal) || name.Contains("SUSPENDED", StringComparison.Ordinal) || name.Contains("ABANDONED", StringComparison.Ordinal)) return ("postponed", shortDetail);
        if (name.Contains("CANCEL", StringComparison.Ordinal)) return ("canceled", shortDetail);
        return state switch
        {
            "in" => ("live", shortDetail is "" or "In Progress" or "Live" ? clock ?? string.Empty : shortDetail),
            "post" => ("finished", shortDetail),
            _ => ("scheduled", string.Empty),
        };
    }

    private static SportsSide? Side(JsonElement competitor)
    {
        string? name = null;
        string? shortName = null;
        string? logo = null;
        if (competitor.TryGetProperty("team", out var team) && team.ValueKind == JsonValueKind.Object)
        {
            name = Text(team, "displayName") ?? Text(team, "name");
            shortName = Text(team, "shortDisplayName") ?? Text(team, "abbreviation");
            // the scoreboard sends "logo", the summary a list of "logos" (the first is the light one)
            logo = Https(Text(team, "logo") ?? (team.TryGetProperty("logos", out var logos) && logos.ValueKind == JsonValueKind.Array && logos.GetArrayLength() > 0 ? Text(logos[0], "href") : null));
        }
        else if (competitor.TryGetProperty("athlete", out var athlete) && athlete.ValueKind == JsonValueKind.Object)
        {
            name = Text(athlete, "displayName") ?? Text(athlete, "fullName");
            shortName = Text(athlete, "shortName");
            logo = athlete.TryGetProperty("flag", out var flag) ? Https(Text(flag, "href")) : null;
        }

        if (string.IsNullOrWhiteSpace(name)) return null;
        bool? winner = competitor.TryGetProperty("winner", out var won) && won.ValueKind is JsonValueKind.True or JsonValueKind.False ? won.GetBoolean() : null;
        return new SportsSide(name.Trim(), shortName?.Trim(), logo, Text(competitor, "score"), winner);
    }

    /// <summary>Only https images of ESPN's own image server are passed on to the browser.</summary>
    private static string? Https(string? value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps && uri.Host.EndsWith(".espncdn.com", StringComparison.OrdinalIgnoreCase) ? value : null;

    private static string? Text(JsonElement element, string name) =>
        element.ValueKind == JsonValueKind.Object && element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;

    [GeneratedRegex(@"^(soccer|basketball|football|hockey|baseball|racing|mma)/[a-z0-9._-]{1,40}$", RegexOptions.CultureInvariant)]
    private static partial Regex CompetitionPattern();

    [GeneratedRegex(@"^\d{1,15}$", RegexOptions.CultureInvariant)]
    private static partial Regex MatchIdPattern();
}
