import type { ReactNode } from 'react'

export type FlagCode =
  | 'de' | 'gb' | 'gb-eng' | 'gb-sct' | 'fr' | 'it' | 'es' | 'tr' | 'sa' | 'nl' | 'pt' | 'be' | 'at' | 'ch' | 'us' | 'mx' | 'br' | 'ar'
  | 'eu' | 'world' | 'racing' | 'fight'

const thirds = (a: string, b: string, c: string): ReactNode => (
  <>
    <rect width="8" height="16" fill={a} />
    <rect x="8" width="8" height="16" fill={b} />
    <rect x="16" width="8" height="16" fill={c} />
  </>
)

const bands = (a: string, b: string, c: string): ReactNode => (
  <>
    <rect width="24" height="5.4" fill={a} />
    <rect y="5.3" width="24" height="5.4" fill={b} />
    <rect y="10.6" width="24" height="5.4" fill={c} />
  </>
)

const euStars = Array.from({ length: 12 }, (_, index) => {
  const angle = (index * Math.PI) / 6
  return <circle key={index} cx={12 + 4.8 * Math.sin(angle)} cy={8 - 4.8 * Math.cos(angle)} r="0.8" fill="#ffcc00" />
})

const checkers = Array.from({ length: 24 }, (_, index) => {
  const column = index % 6
  const row = Math.floor(index / 6)
  return (column + row) % 2 === 0 ? <rect key={index} x={column * 4} y={row * 4} width="4" height="4" fill="#111827" /> : null
})

const usStripes = Array.from({ length: 7 }, (_, index) => <rect key={index} y={index * (32 / 13)} width="24" height={16 / 13} fill="#b22234" />)

const shapes: Record<FlagCode, ReactNode> = {
  de: bands('#000000', '#dd0000', '#ffce00'),
  fr: thirds('#0055a4', '#ffffff', '#ef4135'),
  it: thirds('#009246', '#ffffff', '#ce2b37'),
  be: thirds('#000000', '#fdda24', '#ef3340'),
  mx: <>{thirds('#006847', '#ffffff', '#ce1126')}<circle cx="12" cy="8" r="1.6" fill="#8c6b3d" /></>,
  nl: bands('#ae1c28', '#ffffff', '#21468b'),
  at: bands('#ed2939', '#ffffff', '#ed2939'),
  es: <><rect width="24" height="16" fill="#aa151b" /><rect y="4" width="24" height="8" fill="#f1bf00" /></>,
  tr: (
    <>
      <rect width="24" height="16" fill="#e30a17" />
      <circle cx="9.5" cy="8" r="3.4" fill="#ffffff" />
      <circle cx="10.4" cy="8" r="2.7" fill="#e30a17" />
      <polygon points="13.4,6.3 13.81,7.43 15.02,7.48 14.07,8.22 14.4,9.38 13.4,8.7 12.4,9.38 12.73,8.22 11.78,7.48 12.99,7.43" fill="#ffffff" />
    </>
  ),
  sa: (
    <>
      <rect width="24" height="16" fill="#006c35" />
      <rect x="6" y="5" width="12" height="1.8" rx="0.9" fill="#ffffff" />
      <rect x="7" y="10.4" width="10" height="1" rx="0.5" fill="#ffffff" />
    </>
  ),
  gb: (
    <>
      <rect width="24" height="16" fill="#012169" />
      <path d="M0 0 24 16M24 0 0 16" stroke="#ffffff" strokeWidth="3.2" />
      <path d="M0 0 24 16M24 0 0 16" stroke="#c8102e" strokeWidth="1.1" />
      <path d="M12 0v16M0 8h24" stroke="#ffffff" strokeWidth="5" />
      <path d="M12 0v16M0 8h24" stroke="#c8102e" strokeWidth="3" />
    </>
  ),
  'gb-eng': <><rect width="24" height="16" fill="#ffffff" /><rect x="10.2" width="3.6" height="16" fill="#cf142b" /><rect y="6.2" width="24" height="3.6" fill="#cf142b" /></>,
  'gb-sct': <><rect width="24" height="16" fill="#0065bd" /><path d="M0 0 24 16M24 0 0 16" stroke="#ffffff" strokeWidth="3" /></>,
  pt: <><rect width="24" height="16" fill="#ff0000" /><rect width="9.6" height="16" fill="#006600" /><circle cx="9.6" cy="8" r="2.6" fill="#ffcc00" /></>,
  ch: <><rect width="24" height="16" fill="#d52b1e" /><rect x="10.4" y="3.2" width="3.2" height="9.6" fill="#ffffff" /><rect x="7.2" y="6.4" width="9.6" height="3.2" fill="#ffffff" /></>,
  us: (
    <>
      <rect width="24" height="16" fill="#ffffff" />
      {usStripes}
      <rect width="10.5" height="8.6" fill="#3c3b6e" />
    </>
  ),
  br: <><rect width="24" height="16" fill="#009c3b" /><polygon points="12,1.6 22,8 12,14.4 2,8" fill="#ffdf00" /><circle cx="12" cy="8" r="3.4" fill="#002776" /></>,
  ar: <><rect width="24" height="16" fill="#74acdf" /><rect y="5.4" width="24" height="5.2" fill="#ffffff" /><circle cx="12" cy="8" r="1.5" fill="#f6b40e" /></>,
  eu: <><rect width="24" height="16" fill="#003399" />{euStars}</>,
  world: (
    <>
      <rect width="24" height="16" fill="#475569" />
      <g fill="none" stroke="#e2e8f0" strokeWidth="1">
        <circle cx="12" cy="8" r="5.6" />
        <ellipse cx="12" cy="8" rx="2.4" ry="5.6" />
        <path d="M6.4 8h11.2" />
      </g>
    </>
  ),
  racing: <><rect width="24" height="16" fill="#ffffff" />{checkers}</>,
  fight: (
    <>
      <rect width="24" height="16" fill="#334155" />
      <polygon points="8.5,2.5 15.5,2.5 20,6.5 20,9.5 15.5,13.5 8.5,13.5 4,9.5 4,6.5" fill="none" stroke="#e2e8f0" strokeWidth="1.2" />
    </>
  ),
}

/** A small flag (or a symbol for events that belong to no country) in front of a competition. */
export function Flag({ code }: { code: FlagCode }) {
  return (
    <svg className="sp-flag" viewBox="0 0 24 16" aria-hidden="true" focusable="false">
      {shapes[code]}
    </svg>
  )
}
