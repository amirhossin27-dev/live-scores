import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { SideDrawer } from '../../components/SideDrawer'
import './sportsDetailPanel.css'
import type { Language } from '../../types/platform'
import { CountryFlag } from './CountryFlag'
import { MatchLayers } from './MatchDetails'
import { PlayerProfile } from './PlayerProfile'
import { TeamProfile } from './TeamProfile'
import { localeFor } from './overviewCopy'
import { searchSports } from './sportsApi'
import type { SportsSearchResult } from './sportsApi'
import './sportsSearch.css'

const copy = {
  de: {
    label: 'Spieler, Trainer, Vereine oder Nationalmannschaften suchen',
    placeholder: 'Suchen …',
    hint: 'Fußball entdecken · mindestens 2 Zeichen',
    loading: 'Suche läuft …',
    empty: 'Keine Treffer. Versuche einen anderen Namen.',
    down: 'Die Suche ist gerade nicht erreichbar.',
    retry: 'Erneut versuchen',
    clear: 'Suche leeren',
    close: 'Schließen',
    back: 'Zurück zu den Suchergebnissen',
    all: 'Alle',
    filter: 'Suchergebnisse filtern',
    results: 'Suchergebnisse',
    count: (n: number) => `${n} Treffer`,
    kinds: { player: 'Spieler', coach: 'Trainer', club: 'Vereine', national: 'Nationalteams' },
    singular: { player: 'Spieler', coach: 'Trainer', club: 'Verein', national: 'Nationalmannschaft' },
    backTo: (name: string) => `Zurück zu ${name}`,
  },
  en: {
    label: 'Search players, coaches, clubs or national teams',
    placeholder: 'Search …',
    hint: 'Explore football · type at least 2 characters',
    loading: 'Searching …',
    empty: 'No results. Try another name.',
    down: 'Search is unavailable right now.',
    retry: 'Try again',
    clear: 'Clear search',
    close: 'Close',
    back: 'Back to search results',
    all: 'All',
    filter: 'Filter search results',
    results: 'Search results',
    count: (n: number) => `${n} ${n === 1 ? 'result' : 'results'}`,
    kinds: { player: 'Players', coach: 'Coaches', club: 'Clubs', national: 'National teams' },
    singular: { player: 'Player', coach: 'Coach', club: 'Club', national: 'National team' },
    backTo: (name: string) => `Back to ${name}`,
  },
}

type Kind = SportsSearchResult['kind']
const kinds: Kind[] = ['player', 'coach', 'club', 'national']

function SearchProfile({ result, language, onClose }: { result: SportsSearchResult; language: Language; onClose: () => void }) {
  const t = copy[language === 'de' ? 'de' : 'en']
  const [team, setTeam] = useState<string | null>(null)
  const profileRef = useRef<HTMLDivElement>(null)
  useEffect(() => { profileRef.current?.querySelector<HTMLButtonElement>('button')?.focus() }, [])
  const isTeam = result.kind === 'club' || result.kind === 'national'
  return (
    <MatchLayers language={language} frame={(content) => (
      <SideDrawer className="sports-detail-drawer" title={result.name} subtitle={t.singular[result.kind]} closeLabel={t.close} onClose={onClose}>{content}</SideDrawer>
    )}>
      <div ref={profileRef}>
        <div hidden={team !== null}>
          {isTeam ? (
            <TeamProfile key={result.id} team={{ id: result.id }} language={language} locale={localeFor(language)} backLabel={t.back} onBack={onClose} />
          ) : (
            <PlayerProfile key={result.id} id={result.id} name={result.name} language={language} locale={localeFor(language)} backLabel={t.back} onBack={onClose} onOpenTeam={setTeam} />
          )}
        </div>
        {team && <TeamProfile key={team} team={{ id: team }} language={language} locale={localeFor(language)} backLabel={t.backTo(result.name)} onBack={() => setTeam(null)} />}
      </div>
    </MatchLayers>
  )
}

/** Debounced football discovery, independent of the selected day and competitions. */
export function SportsSearch({ language }: { language: Language }) {
  const lang = language === 'de' ? 'de' : 'en'
  const t = copy[lang]
  const id = useId()
  const host = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<Kind | 'all'>('all')
  const [active, setActive] = useState(-1)
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState<{ key: string; results: SportsSearchResult[] } | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [selected, setSelected] = useState<SportsSearchResult | null>(null)
  const term = query.trim()
  const key = `${lang}|${term}`
  const ready = term.length >= 2
  const results = loaded?.key === key ? loaded.results : null
  const shown = (results ?? []).filter((item) => kind === 'all' || item.kind === kind)
  const pending = ready && results === null && failed !== key
  const expanded = open && ready

  useEffect(() => {
    if (!ready) return undefined
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      searchSports(term, lang, controller.signal)
        .then((items) => {
          if (controller.signal.aborted) return
          setLoaded({ key, results: items })
          setFailed(null)
        })
        .catch(() => { if (!controller.signal.aborted) setFailed(key) })
    }, 280)
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [term, lang, key, ready, attempt])

  useEffect(() => {
    function outside(event: PointerEvent) {
      if (host.current && !host.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [])

  useEffect(() => {
    if (expanded && active >= 0) document.getElementById(`${id}-result-${active}`)?.scrollIntoView?.({ block: 'nearest' })
  }, [active, expanded, id])

  function choose(result: SportsSearchResult) {
    setSelected(result)
    setOpen(false)
    setActive(-1)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape' && open) {
      event.stopPropagation()
      setOpen(false)
      setActive(-1)
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      if (shown.length > 0) setActive((value) => event.key === 'ArrowDown' ? (value + 1) % shown.length : (value <= 0 ? shown.length - 1 : value - 1))
    } else if (event.key === 'Enter' && expanded && shown.length > 0) {
      event.preventDefault()
      choose(shown[active >= 0 && active < shown.length ? active : 0])
    }
  }

  return (
    <>
      <div className="sp-search" ref={host} onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
      }}>
        <div className={`sp-search-field${expanded ? ' is-open' : ''}`}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
          <input
            ref={input} type="search" role="combobox" aria-label={t.label} placeholder={t.placeholder} title={t.label} aria-describedby={`${id}-hint`}
            aria-autocomplete="list" aria-expanded={expanded} aria-controls={expanded ? `${id}-results` : undefined}
            aria-activedescendant={expanded && active >= 0 && shown[active] ? `${id}-result-${active}` : undefined}
            autoComplete="off" spellCheck={false} maxLength={80} value={query}
            onChange={(event) => { setQuery(event.target.value); setOpen(true); setActive(-1) }}
            onFocus={() => setOpen(true)} onKeyDown={onKeyDown}
          />
          {query && <button type="button" className="sp-search-clear" aria-label={t.clear} onClick={() => { setQuery(''); setActive(-1); input.current?.focus() }}>×</button>}
        </div>
        <span id={`${id}-hint`} className="sp-search-hint">{t.hint}</span>
        {expanded && (
          <div className="sp-search-popover">
            <div className="sp-search-filters" role="group" aria-label={t.filter}>
              {(['all', ...kinds] as const).map((value) => (
                <button type="button" key={value} aria-pressed={kind === value} className={kind === value ? 'is-active' : ''} onClick={() => { setKind(value); setActive(-1); input.current?.focus() }}>
                  {value === 'all' ? t.all : t.kinds[value]}
                  {results && <small>{value === 'all' ? results.length : results.filter((item) => item.kind === value).length}</small>}
                </button>
              ))}
            </div>
            <p className="sp-search-status" role="status">
              {pending ? t.loading : failed === key ? t.down : shown.length === 0 ? t.empty : t.count(shown.length)}
              {failed === key && <button type="button" className="sp-text-button" onClick={() => { setFailed(null); setAttempt((value) => value + 1) }}>{t.retry}</button>}
            </p>
            <ul id={`${id}-results`} className="sp-search-results" role="listbox" aria-label={t.results} aria-busy={pending}>
              {shown.map((result, index) => (
                <li key={`${result.kind}-${result.id}`} role="none">
                  <button type="button" role="option" tabIndex={-1} id={`${id}-result-${index}`} aria-selected={active === index}
                    className={`sp-search-result${active === index ? ' is-active' : ''}`} onClick={() => choose(result)} onMouseEnter={() => setActive(index)}>
                    <span className={`sp-search-avatar is-${result.kind}`}>
                      {result.logo ? <img src={result.logo} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span aria-hidden="true">{result.name.slice(0, 1)}</span>}
                    </span>
                    <span className="sp-search-name"><strong>{result.name}</strong><small>{result.description ?? t.singular[result.kind]}</small></span>
                    <CountryFlag country={result.country} language={language} />
                    <span className="sp-search-kind">{t.singular[result.kind]}</span>
                    <span className="sp-search-arrow" aria-hidden="true">↗</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {selected && <SearchProfile key={`${selected.kind}-${selected.id}`} result={selected} language={language} onClose={() => { setSelected(null); setOpen(true); input.current?.focus() }} />}
    </>
  )
}
