import { useId } from 'react'

// Points of a regular pentagon around (cx, cy), the first one pointing in the direction `start` (degrees, 0 = up).
function pentagon(cx: number, cy: number, radius: number, start: number) {
  return Array.from({ length: 5 }, (_, index) => {
    const angle = ((start + index * 72) * Math.PI) / 180
    return `${(cx + radius * Math.sin(angle)).toFixed(2)},${(cy - radius * Math.cos(angle)).toFixed(2)}`
  }).join(' ')
}

function point(radius: number, angle: number) {
  const radians = (angle * Math.PI) / 180
  return { x: 12 + radius * Math.sin(radians), y: 12 - radius * Math.cos(radians) }
}

const angles = [0, 72, 144, 216, 288]
const centre = pentagon(12, 12, 3.9, 0)
// like on a real ball, a seam runs from each corner of the centre patch to a patch at the rim (cut off by the outline) ...
const rim = angles.map((angle) => {
  const middle = point(10.6, angle)
  return pentagon(middle.x, middle.y, 3.4, angle + 180)
})
const seams = angles.map((angle) => {
  const from = point(3.9, angle)
  const to = point(10.6 - 3.4, angle)
  return { x1: from.x, y1: from.y, x2: to.x, y2: to.y }
})
// ... and the hexagons between them are closed by a seam from one rim patch to the next
const corner = (angle: number, turn: number) => {
  const middle = point(10.6, angle)
  const radians = ((angle + 180 + turn) * Math.PI) / 180
  return { x: middle.x + 3.4 * Math.sin(radians), y: middle.y - 3.4 * Math.cos(radians) }
}
const sides = angles.map((angle) => {
  const from = corner(angle, 144)
  const to = corner(angle + 72, 216)
  return { x1: from.x, y1: from.y, x2: to.x, y2: to.y }
})

/**
 * A football as a solid disc with the classic pattern cut out: `goal` in the colour of the text (black in the light theme,
 * white in the dark one), `own-goal` in red, so the two cannot be mixed up even without colour labels.
 */
export function FootballIcon({ size = 18, title, variant = 'goal' }: { size?: number; title?: string; variant?: 'goal' | 'own-goal' }) {
  const clip = useId()
  return (
    <svg className={`football-icon is-${variant}`} viewBox="0 0 24 24" width={size} height={size} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <clipPath id={clip}>
          <circle cx="12" cy="12" r="10.2" />
        </clipPath>
      </defs>
      <circle className="football-icon-ball" cx="12" cy="12" r="11" />
      <g className="football-icon-pattern" clipPath={`url(#${clip})`} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
        <polygon points={centre} />
        {rim.map((points) => <polygon key={points} points={points} />)}
        {[...seams, ...sides].map((seam) => <line key={`${seam.x1}-${seam.y1}`} {...seam} />)}
      </g>
    </svg>
  )
}
