import type { CSSProperties } from 'react'
import type { SportsText } from './sportsApi'

// Provider colours can be almost black. Use a readable palette for each meaning;
// preserve the provider's zone metadata separately from its display colours.
const palettes = {
  champions: ['#0369a1', '#7dd3fc'],
  europa: ['#c2410c', '#fdba74'],
  conference: ['#4d7c0f', '#bef264'],
  promotion: ['#047857', '#6ee7b7'],
  relegation: ['#991b1b', '#b91c1c'],
  relegationPlayoff: ['#fecaca', '#fda4af'],
  playoff: ['#a16207', '#fde047'],
  eliminated: ['#475569', '#cbd5e1'],
  qualification: ['#7e22ce', '#d8b4fe'],
} as const

export function zoneAppearance(label: SportsText): CSSProperties {
  const meaning = `${label.key ?? ''} ${label.text}`.toLowerCase().replace(/[_–—-]/g, ' ').replace(/\s+/g, ' ')
  const relegation = /relegat|abstieg/.test(meaning)
  const relegationPlayoff = relegation && /qual|play\s?offs?|relegationsspiel/.test(meaning)
  let palette: readonly [string, string]
  if (relegationPlayoff) palette = palettes.relegationPlayoff
  else if (relegation) palette = palettes.relegation
  else if (/champions\s?league/.test(meaning)) palette = palettes.champions
  else if (/conference/.test(meaning)) palette = palettes.conference
  else if (/europa/.test(meaning)) palette = palettes.europa
  else if (/playoff|play off|possible qualification/.test(meaning)) palette = palettes.playoff
  else if (/promotion/.test(meaning)) palette = palettes.promotion
  else if (/eliminat/.test(meaning)) palette = palettes.eliminated
  else if (/qualif|advance|finals|next stage/.test(meaning)) palette = palettes.qualification
  // An unlabeled provider marker must not borrow the colour of a known competition.
  else palette = palettes.eliminated
  return {
    '--st-zone-light': palette[0],
    '--st-zone-dark': palette[1],
    '--st-zone-text-light': relegationPlayoff ? '#7f1d1d' : '#ffffff',
    '--st-zone-text-dark': relegation && !relegationPlayoff ? '#ffffff' : '#0b1324',
    // The light red badge needs an outline on white; dark red needs one on dark surfaces.
    '--st-zone-edge-light': relegationPlayoff ? '#b91c1c' : palette[0],
    '--st-zone-edge-dark': relegation && !relegationPlayoff ? '#f87171' : palette[1],
  } as CSSProperties
}
