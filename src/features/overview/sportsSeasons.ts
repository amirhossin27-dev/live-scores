export function normalizeSportsSeason(value: string | null | undefined): string | null {
  if (!value) return null
  const match = /^(\d{4})(?:[-/](\d{2}|\d{4}))?$/.exec(value)
  if (!match || Number(match[1]) < 1990) return null
  const start = Number(match[1])
  if (!match[2]) return match[1]
  const end = match[2].length === 2 ? Math.floor(start / 100) * 100 + Number(match[2]) + (Number(match[2]) < start % 100 ? 100 : 0) : Number(match[2])
  return end === start + 1 ? `${start}/${end}` : null
}

export function sportsSeasonOptions(...lists: (readonly (string | null | undefined)[])[]): string[] {
  return [...new Set(lists.flat().map(normalizeSportsSeason).filter((value): value is string => value !== null))].sort().reverse()
}
