namespace Standalone.Api.Services;

public sealed partial class SportsService
{
    /// <summary>Known current-season naming differences only; never collapse historical phases or unrelated cycles.</summary>
    private static string? QualificationSourceSeason(string competition, string? targetSeason, string? sourceSeason)
    {
        var target = SportsSeasons.Normalize(targetSeason);
        var source = SportsSeasons.Normalize(sourceSeason);
        if (target is { Length: 4 })
        {
            if (competition == "soccer/fifa.worldq.uefa" && source is { Length: 9 } && source.EndsWith("/" + target, StringComparison.Ordinal))
                return target;
            if (competition == "soccer/arg.1" && (sourceSeason == target + " - Apertura" || sourceSeason == target + " - Clausura"))
                return target;
        }
        return source;
    }

    /// <summary>
    /// ESPN combines all UEFA Nations League divisions; FotMob publishes A–D as separate leagues.
    /// Load them concurrently through the existing per-league cache. Only combine tables of the same season;
    /// the championship bracket belongs to A, while form/next-match data belongs to all four divisions.
    /// </summary>
    private async Task<FotMobLeague?> GetCompetitionLeagueAsync(string competition, CancellationToken cancellationToken, string? season)
    {
        var primaryId = FotMobLeagues[competition];
        if (competition != "soccer/uefa.nations") return await fotMob!.GetLeagueAsync(primaryId, cancellationToken, season);

        int[] ids = [primaryId, 9807, 9808, 9809];
        var leagues = await Task.WhenAll(ids.Select(id => fotMob!.GetLeagueAsync(id, cancellationToken, season)));
        var primary = leagues[0];
        var selectedSeason = SportsSeasons.Normalize(season ?? primary?.Season)
            ?? leagues.Select(league => SportsSeasons.Normalize(league?.Season)).OfType<string>().FirstOrDefault();
        var compatible = leagues.Select((league, index) => (League: league, Index: index))
            .Where(item => item.League is not null && selectedSeason is not null
                && SportsSeasons.Normalize(item.League.Season) == selectedSeason).ToArray();
        if (compatible.Length == 0) return primary;

        var tables = compatible.Where(item => item.League!.Table is not null).ToArray();
        SportsTable? table = tables.Length == 0 ? null : new SportsTable(
            tables[0].League!.Table!.Columns,
            tables.SelectMany(item => item.League!.Table!.Groups.Select(group => group with
            {
                Name = $"League {(char)('A' + item.Index)}" + (group.Name is null ? "" : $", {group.Name}"),
            })).ToArray(),
            tables.SelectMany(item => item.League!.Table!.Zones).Distinct().ToArray(),
            "fotmob");
        return new FotMobLeague(selectedSeason, table,
            SportsSeasons.Normalize(primary?.Season) == selectedSeason ? primary?.Bracket : null,
            compatible.SelectMany(item => item.League!.Fixtures ?? []).DistinctBy(fixture => fixture.Id).OrderBy(fixture => fixture.Start).ToArray(),
            SportsSeasons.Combine(leagues.SelectMany(league => league?.Seasons ?? [])));
    }
}
