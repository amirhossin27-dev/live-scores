import { useEffect, useState } from 'react'
import { DetailBack, useDetailNavigation } from '../../components/DetailNavigation'
import type { Language } from '../../types/platform'
import { loadNationalTeam } from './sportsApi'
import type { SportsCountry } from './sportsApi'
import { localeFor } from './overviewCopy'
import { TeamProfile } from './TeamProfile'

/** Resolution belongs to the visit: going back aborts it and cannot reopen a closed view. */
export function NationalTeamProfile({ country, language, backLabel }: { country: SportsCountry; language: Language; backLabel: string }) {
  const navigation = useDetailNavigation()!
  const [team, setTeam] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    loadNationalTeam(country, controller.signal).then((result) => {
      if (!controller.signal.aborted) setTeam(result.id)
    }).catch(() => { if (!controller.signal.aborted) setFailed(true) })
    return () => controller.abort()
  }, [country, attempt])
  if (team) return <TeamProfile team={{ id: team }} language={language} locale={localeFor(language)} onBack={navigation.back} backLabel={backLabel} />
  return <><DetailBack onBack={navigation.back} label={backLabel} /><p role="status">{failed ? (language === 'de' ? 'Die Nationalmannschaft ist gerade nicht verfügbar.' : 'The national team is currently unavailable.') : (language === 'de' ? 'Nationalmannschaft wird geladen …' : 'Loading national team …')}</p>{failed && <button type="button" className="sp-text-button" onClick={() => { setFailed(false); setAttempt((value) => value + 1) }}>{language === 'de' ? 'Erneut versuchen' : 'Try again'}</button>}</>
}
