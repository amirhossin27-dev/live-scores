/** Colour band of a match rating (0-10), like the usual football apps: from red (weak) to dark green (outstanding). */
function ratingBand(rating: number) {
  if (rating >= 8) return 'is-top'
  if (rating >= 7) return 'is-good'
  if (rating >= 6) return 'is-fair'
  return 'is-weak'
}

export function Rating({ value, locale, className = '' }: { value: number | null; locale: string; className?: string }) {
  if (value === null) return null
  const text = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)
  return <span className={`sp-rating ${ratingBand(value)} ${className}`.trim()}>{text}</span>
}
