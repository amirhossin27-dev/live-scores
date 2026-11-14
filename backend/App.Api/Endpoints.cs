using Standalone.Api.Services;
namespace Standalone.Api;
public static class Endpoints {
 public static IEndpointRouteBuilder MapPublicData(this IEndpointRouteBuilder app) {
        var sports = app.MapGroup("/api/sports").WithTags("Sports");
        sports.MapGet("/national-team", async Task<IResult> (string? code, FotMobService service, CancellationToken cancellationToken) =>
        {
            if (!FotMobService.IsValidNationalTeamCode(code))
                return Results.BadRequest(new { error = "Send a three-letter FIFA country code such as GER." });
            var result = await service.GetNationalTeamAsync(code!, cancellationToken);
            if (result.Failed) return Results.Json(new { error = "The national team source is not reachable right now." }, statusCode: StatusCodes.Status502BadGateway);
            return result.Team is null ? Results.NotFound(new { error = "No unambiguous senior national team was found for this country." }) : Results.Ok(result.Team);
        });
        sports.MapGet("/search", async Task<IResult> (string? q, string? language, FotMobService service, CancellationToken cancellationToken) =>
        {
            if (!FotMobService.IsValidSearchQuery(q) || language is not (null or "de" or "en"))
                return Results.BadRequest(new { error = "Send a search term of 2 to 80 characters and, optionally, de or en as language." });
            var results = await service.SearchAsync(q!, language ?? "de", cancellationToken);
            return results is null ? Results.Json(new { error = "The search is not reachable right now." }, statusCode: StatusCodes.Status502BadGateway) : Results.Ok(results);
        });
        sports.MapGet("/player/matches", async Task<IResult> (string? id, string? season, FotMobService service, CancellationToken cancellationToken) =>
        {
            if (!FotMobService.IsValidPlayerId(id) || !FotMobService.TryPlayerSeasonDates(season, out _, out _))
                return Results.BadRequest(new { error = "Send the numeric id of a player and a season such as 2026/2027 or 2026." });
            var matches = await service.GetPlayerMatchesAsync(id!, season!, cancellationToken);
            return matches is null ? Results.Json(new { error = "The season matches are not reachable right now." }, statusCode: StatusCodes.Status502BadGateway) : Results.Ok(matches);
        });
        sports.MapGet("/scores", async Task<IResult> (string? competitions, string? date, SportsService service, CancellationToken cancellationToken) =>
        {
            var ids = (competitions ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (ids.Length == 0 || ids.Length > SportsService.MaxCompetitions || ids.Any(id => !SportsService.IsValidCompetition(id)))
            {
                return Results.BadRequest(new { error = $"Send 1 to {SportsService.MaxCompetitions} valid competitions." });
            }

            if (!SportsService.TryParseDate(date, out _)) return Results.BadRequest(new { error = "The date must look like 20261007." });
            return Results.Ok(await service.GetScoresAsync(ids, date!, cancellationToken));
        });
        sports.MapGet("/match", async Task<IResult> (string? competition, string? id, SportsService service, CancellationToken cancellationToken) =>
        {
            if (!SportsService.IsValidCompetition(competition) || !SportsService.IsTeamSport(competition!) || !SportsService.IsValidMatchId(id))
            {
                return Results.BadRequest(new { error = "Send a team sport competition and the id of one of its matches." });
            }

            var details = await service.GetMatchAsync(competition!, id!, cancellationToken);
            return details is null ? Results.Json(new { error = "The match details are not reachable right now." }, statusCode: StatusCodes.Status502BadGateway) : Results.Ok(details);
        });
        // A match of FotMob (team page, player profile, form in a table) in ESPN's scores, so that it opens the match panel.
        sports.MapGet("/match/find", async Task<IResult> (string? fotmob, SportsService service, CancellationToken cancellationToken) =>
        {
            if (!FotMobService.IsValidPlayerId(fotmob)) return Results.BadRequest(new { error = "Send the numeric FotMob id of a match." });
            var link = await service.FindMatchAsync(fotmob!, cancellationToken);
            return link is null ? Results.NotFound(new { error = "The match is not in the live scores." }) : Results.Ok(link);
        });
        sports.MapGet("/broadcasts", async Task<IResult> (string? competition, string? id, SportsService service, CancellationToken cancellationToken) =>
        {
            if (!SportsService.IsValidCompetition(competition) || !SportsService.IsTeamSport(competition!) || !SportsService.IsValidMatchId(id))
            {
                return Results.BadRequest(new { error = "Send a team sport competition and the id of one of its matches." });
            }

            var broadcasts = await service.GetBroadcastsAsync(competition!, id!, cancellationToken);
            return broadcasts is null ? Results.Json(new { error = "The broadcasts are not reachable right now." }, statusCode: StatusCodes.Status502BadGateway) : Results.Ok(broadcasts);
        });
        sports.MapGet("/scorers", async Task<IResult> (string? competition, string? season, SportsService service, CancellationToken cancellationToken) =>
        {
            if (!SportsService.IsValidCompetition(competition) || !competition!.StartsWith("soccer/", StringComparison.Ordinal)
                || season is not null && SportsSeasons.Normalize(season) is null)
                return Results.BadRequest(new { error = "Send a football competition and, optionally, a season such as 2026-27." });
            var scorers = await service.GetScorersAsync(competition, season, cancellationToken);
            return scorers is null ? Results.Json(new { error = "The scorer statistics are not reachable right now." }, statusCode: StatusCodes.Status502BadGateway) : Results.Ok(scorers);
        });
        sports.MapGet("/standings", async Task<IResult> (string? competition, string? match, string? season, SportsService service, CancellationToken cancellationToken) =>
        {
            if (!SportsService.IsValidCompetition(competition) || !SportsService.HasStandings(competition!) || match is not null && !SportsService.IsValidMatchId(match) || season is not null && SportsSeasons.Normalize(season) is null)
            {
                return Results.BadRequest(new { error = "Send a competition that has a table or a knock-out stage and, if you like, the id of one of its matches." });
            }

            var standings = await service.GetStandingsAsync(competition!, match, cancellationToken, season);
            return standings is null ? Results.Json(new { error = "The table is not reachable right now." }, statusCode: StatusCodes.Status502BadGateway) : Results.Ok(standings);
        });
        sports.MapGet("/player", async Task<IResult> (string? id, string? language, FotMobService service, CancellationToken cancellationToken) =>
        {
            if (!FotMobService.IsValidPlayerId(id) || language is not (null or "de" or "en")) return Results.BadRequest(new { error = "Send the numeric id of a player and, if you like, the language (de or en)." });
            var profile = await service.GetPlayerAsync(id!, language ?? "de", cancellationToken);
            return profile is null ? Results.Json(new { error = "The player profile is not reachable right now." }, statusCode: StatusCodes.Status502BadGateway) : Results.Ok(profile);
        });
        // The headline figures of one season and competition of a player (the entries come with the profile).
        sports.MapGet("/player/season", async Task<IResult> (string? id, string? entry, FotMobService service, CancellationToken cancellationToken) =>
        {
            if (!FotMobService.IsValidPlayerId(id) || !FotMobService.IsValidSeasonEntry(entry)) return Results.BadRequest(new { error = "Send the numeric id of a player and a season entry such as 1-0." });
            var stats = await service.GetPlayerSeasonAsync(id!, entry!, cancellationToken);
            return stats is null ? Results.Json(new { error = "The season figures are not reachable right now." }, statusCode: StatusCodes.Status502BadGateway) : Results.Ok(stats);
        });
        // A team page (football, FotMob): by FotMob's id, or by a match of the scores and its side.
        sports.MapGet("/team", async Task<IResult> (string? id, string? competition, string? match, string? side, SportsService sportsService, FotMobService service, CancellationToken cancellationToken) =>
        {
            if (id is null)
            {
                if (!SportsService.IsValidCompetition(competition) || !competition!.StartsWith("soccer/", StringComparison.Ordinal) || !SportsService.IsValidMatchId(match) || side is not ("home" or "away"))
                {
                    return Results.BadRequest(new { error = "Send the FotMob id of a team, or a football competition, the id of one of its matches and the side (home or away)." });
                }

                id = await sportsService.GetTeamIdAsync(competition, match!, side, cancellationToken);
                if (id is null) return Results.NotFound(new { error = "The team was not found at the source." });
            }
            else if (!FotMobService.IsValidTeamId(id))
            {
                return Results.BadRequest(new { error = "Send the numeric id of a team." });
            }

            var team = await service.GetTeamAsync(id, cancellationToken);
            return team is null ? Results.Json(new { error = "The team page is not reachable right now." }, statusCode: StatusCodes.Status502BadGateway) : Results.Ok(team);
        });
        sports.MapGet("/team/news", async Task<IResult> (string? id, string? language, FotMobService service, CancellationToken cancellationToken) =>
        {
            if (!FotMobService.IsValidTeamId(id) || language is not ("de" or "en")) return Results.BadRequest(new { error = "Send the numeric id of a team and the language (de or en)." });
            var news = await service.GetTeamNewsAsync(id!, language, cancellationToken);
            return news is null ? Results.Json(new { error = "The news are not reachable right now." }, statusCode: StatusCodes.Status502BadGateway) : Results.Ok(news);
        });

  return app;
 }
}
