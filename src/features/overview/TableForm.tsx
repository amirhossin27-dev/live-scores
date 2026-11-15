import { useModal } from '../../components/useModal'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FocusEvent, KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useKeepInViewport } from '../../components/keepInViewport'
import type { AnchorBox } from '../../components/keepInViewport'
import type { Language } from '../../types/platform'
import { localeFor } from './overviewCopy'
import type { SportsTableRow, SportsTeamFixture } from './sportsApi'
import { useOpenMatch } from './sportsMatchNav'
import { teamName } from './sportsNames'

const copy = {
  de: {
    title: (team: string) => `Form von ${team}`,
    letters: { win: 'S', draw: 'U', loss: 'N' },
    results: { win: 'Sieg', draw: 'Unentschieden', loss: 'Niederlage' },
    next: 'Nächstes Spiel',
    live: 'Läuft',
    last: (count: number) => `Letzte ${count} Spiele`,
    open: 'Spielinfo öffnen',
    backToTable: 'Zurück zur Tabelle', close: 'Schließen',
  },
  en: {
    title: (team: string) => `Form of ${team}`,
    letters: { win: 'W', draw: 'D', loss: 'L' },
    results: { win: 'Win', draw: 'Draw', loss: 'Loss' },
    next: 'Next match',
    live: 'Live',
    last: (count: number) => `Last ${count} matches`,
    open: 'Open the match info',
    backToTable: 'Back to the table', close: 'Close',
  },
}

type Copy = (typeof copy)['de']

const closeDelay = 140

function Crest({ logo }: { logo: string | null }) {
  return logo ? <img className="st-form-crest" src={logo} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="st-form-crest is-empty" aria-hidden="true" />
}

/** The match a square stands for: date (and kick-off of the next one), both teams in two lines with their goals, the team of the row in bold. */
function FormMatch({ fixture, teamId, isNext, t, language }: { fixture: SportsTeamFixture; teamId: string; isNext: boolean; t: Copy; language: Language }) {
  const locale = localeFor(language)
  const when = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' }), [locale])
  const time = useMemo(() => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }), [locale])
  const start = new Date(fixture.start)
  const scored = fixture.home.score !== null && fixture.away.score !== null
  const live = fixture.status === 'live'
  const head = [isNext ? (live ? t.live : t.next) : null, when.format(start), fixture.status === 'scheduled' ? time.format(start) : null].filter(Boolean).join(' · ')
  const goals = (score: number | null) => (scored && fixture.status !== 'scheduled' ? score : '–')
  return (
    <div className="st-form-match">
      <small>{head}</small>
      <span className={`st-form-line${fixture.home.id === teamId ? ' is-own' : ''}`}>
        <Crest logo={fixture.home.logo} />
        <span>{teamName(fixture.home.name, language)}</span>
        <b className={live ? 'is-live' : undefined}>{goals(fixture.home.score)}</b>
      </span>
      <span className={`st-form-line${fixture.away.id === teamId ? ' is-own' : ''}`}>
        <Crest logo={fixture.away.logo} />
        <span>{teamName(fixture.away.name, language)}</span>
        <b className={live ? 'is-live' : undefined}>{goals(fixture.away.score)}</b>
      </span>
    </div>
  )
}

interface FormCellProps {
  row: SportsTableRow
  value: string
  language: Language
}

/**
 * The number of matches played; hovering it (or focusing it) shows the form of the team: a square for the next match ("?") and
 * one for each of the last five results, newest first. A square shows its match underneath, a click opens the match info.
 */
export function FormCell({ row, value, language }: FormCellProps) {
  const t = copy[language === 'de' ? 'de' : 'en']
  const openMatch = useOpenMatch()
  const [anchor, setAnchor] = useState<(AnchorBox & { x: number }) | null>(null)
  const [chosen, setChosen] = useState<string | null>(null)
  const timer = useRef(0)
  const popRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const restoringFocus = useRef(false)
  const dismiss = () => { setAnchor(null); setChosen(null) }
  useModal(popRef, anchor !== null, dismiss, (previous) => {
    // Restoring the trigger is not a fresh request to open its focus popup.
    restoringFocus.current = previous === triggerRef.current
    try { previous.focus({ preventScroll: true }) }
    finally { restoringFocus.current = false }
  })
  useKeepInViewport(popRef, { anchor, open: anchor !== null, key: anchor })

  // a fixed pop-up does not move with the panel: it closes when anything scrolls
  useEffect(() => {
    if (!anchor) return undefined
    const close = () => { setAnchor(null); setChosen(null) }
    window.addEventListener('scroll', close, true)
    return () => window.removeEventListener('scroll', close, true)
  }, [anchor])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const form = row.form ?? []
  const next = row.next ?? null
  const teamId = row.teamId ?? ''
  if (form.length === 0 && !next) return <>{value}</>

  const show = () => {
    window.clearTimeout(timer.current)
    const box = triggerRef.current?.getBoundingClientRect()
    if (box && !anchor) setAnchor({ top: box.top, bottom: box.bottom, x: box.left + box.width / 2 })
  }
  const hide = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      setAnchor(null)
      setChosen(null)
    }, closeDelay)
  }
  const keep = () => window.clearTimeout(timer.current)
  const onBlur = (event: FocusEvent) => {
    // focus moving between the number and the squares keeps the pop-up open
    if (!(event.relatedTarget instanceof Node) || !popRef.current?.contains(event.relatedTarget) && event.relatedTarget !== triggerRef.current) hide()
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !anchor) return
    // the panel closes on Escape too: only the pop-up does here
    event.stopPropagation()
    dismiss()
  }
  const open = (fixture: SportsTeamFixture) => {
    if (!openMatch) return
    window.clearTimeout(timer.current)
    dismiss()
    openMatch({ fotmob: fixture.id, back: t.backToTable })
  }

  const items: { fixture: SportsTeamFixture; next: boolean }[] = [...(next ? [{ fixture: next, next: true }] : []), ...form.map((fixture) => ({ fixture, next: false }))]
  const shown = items.find((item) => item.fixture.id === chosen) ?? items[0]
  const name = teamName(row.name, language)
  const label = (item: { fixture: SportsTeamFixture; next: boolean }) => {
    const { fixture } = item
    const teams = `${teamName(fixture.home.name, language)} – ${teamName(fixture.away.name, language)}`
    if (item.next) return `${t.next}: ${teams}`
    const result = fixture.result ? `${t.results[fixture.result]}: ` : ''
    return `${result}${teams} ${fixture.home.score ?? '–'}:${fixture.away.score ?? '–'}`
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`st-played${anchor ? ' is-open' : ''}`}
        aria-expanded={anchor !== null}
        aria-label={`${value} · ${t.title(name)}`}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={() => { if (!restoringFocus.current) show() }}
        onBlur={onBlur}
        onClick={() => (anchor ? setAnchor(null) : show())}
        onKeyDown={onKeyDown}
      >
        {value}
      </button>
      {anchor && createPortal(
        <div
          ref={popRef}
          className="st-form-pop"
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          aria-label={t.title(name)}
          style={{ left: anchor.x, top: anchor.bottom + 6 }}
          onMouseEnter={keep}
          onMouseLeave={hide}
          onFocus={keep}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
        >
          <button type="button" className="sp-text-button" onClick={dismiss}>{t.close}</button>
          <ol className="st-form" aria-label={t.last(form.length)}>
            {items.map((item) => (
              <li key={item.fixture.id}>
                <button
                  type="button"
                  className={`st-form-box ${item.next ? 'is-next' : `is-${item.fixture.result ?? 'none'}`}${item === shown ? ' is-chosen' : ''}`}
                  aria-label={label(item)}
                  title={openMatch ? t.open : undefined}
                  disabled={!openMatch}
                  onMouseEnter={() => setChosen(item.fixture.id)}
                  onFocus={() => setChosen(item.fixture.id)}
                  onClick={() => open(item.fixture)}
                >
                  {item.next ? '?' : item.fixture.result ? t.letters[item.fixture.result] : '–'}
                </button>
              </li>
            ))}
          </ol>
          <FormMatch fixture={shown.fixture} teamId={teamId} isNext={shown.next} t={t} language={language} />
        </div>,
        document.body,
      )}
    </>
  )
}
