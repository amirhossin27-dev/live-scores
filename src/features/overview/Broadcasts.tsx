import type { Language } from '../../types/platform'
import { Flag } from './Flag'
import type { FlagCode } from './Flag'
import { useBroadcasts } from './sportsHooks'

const copy = {
  de: {
    loading: 'Übertragungen werden geladen …',
    down: 'Die Übertragungen sind gerade nicht erreichbar.',
    retry: 'Erneut versuchen',
    none: 'Für dieses Spiel sind (noch) keine Übertragungen bekannt.',
    noChannel: 'Keine Übertragung bekannt',
    hint: 'Übertragungen können sich kurzfristig ändern.',
  },
  en: {
    loading: 'Loading the broadcasts …',
    down: 'The broadcasts are not reachable right now.',
    retry: 'Try again',
    none: 'No broadcasts are known for this match (yet).',
    noChannel: 'No broadcast known',
    hint: 'Broadcasts can change at short notice.',
  },
}

const countries: Record<string, { flag: FlagCode; de: string; en: string }> = {
  DE: { flag: 'de', de: 'Deutschland', en: 'Germany' },
  AT: { flag: 'at', de: 'Österreich', en: 'Austria' },
  CH: { flag: 'ch', de: 'Schweiz', en: 'Switzerland' },
  GB: { flag: 'gb', de: 'Vereinigtes Königreich', en: 'United Kingdom' },
  US: { flag: 'us', de: 'USA', en: 'USA' },
}

/** Where a match is shown on TV or as a stream, per country (Germany first); loaded when the tab is opened. */
export function Broadcasts({ competition, matchId, language }: { competition: string; matchId: string; language: Language }) {
  const lang = language === 'de' ? 'de' : 'en'
  const t = copy[lang]
  const { broadcasts, loading, retry } = useBroadcasts(competition, matchId)

  if (!broadcasts) {
    return loading
      ? <p className="md-empty" aria-live="polite">{t.loading}</p>
      : <div className="md-empty" aria-live="polite"><span>{t.down}</span> <button type="button" className="sp-text-button" onClick={retry}>{t.retry}</button></div>
  }

  const known = broadcasts.countries.filter((country) => countries[country.country])
  if (!known.some((country) => country.channels.length > 0)) return <p className="md-empty">{t.none}</p>

  return (
    <>
      <ul className="bc-list">
        {known.map((country) => {
          const meta = countries[country.country]
          return (
            <li key={country.country} className={`bc-country${country.channels.length === 0 ? ' is-empty' : ''}`}>
              <span className="bc-name"><Flag code={meta.flag} />{meta[lang]}</span>
              {country.channels.length > 0 ? (
                <span className="bc-channels">
                  {country.channels.map((channel) => <span key={channel} className="bc-channel">{channel}</span>)}
                </span>
              ) : (
                <span className="bc-none">{t.noChannel}</span>
              )}
            </li>
          )
        })}
      </ul>
      <p className="sp-foot st-foot">{t.hint}</p>
    </>
  )
}
