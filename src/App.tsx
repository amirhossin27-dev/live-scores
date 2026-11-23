import { useEffect, useState } from 'react'
import { SportsWidget } from './features/overview/SportsWidget'
import { apiBaseUrl } from './services/platformApi'
import { readViewOptions, readSetting, writeSetting } from './runtime.mjs'
import type { Language } from './types/platform'
import './app.css'

type Theme = 'auto' | 'dark' | 'light'
export function App() {
 const [options] = useState(() => readViewOptions(window.location.href))
 const { embedded, compact } = options
 const viewportDrawers = compact && new URLSearchParams(window.location.search).get('viewportDrawers') === '1'
 const [language,setLanguage] = useState<Language>(()=>embedded ? options.language : readSetting('live-scores.language','de',['de','en']))
 const [theme,setTheme] = useState<Theme>(()=>embedded ? options.theme : readSetting('live-scores.theme','auto',['auto','dark','light']))
 const [now,setNow] = useState(()=>new Date())
 const de = language === 'de'
 useEffect(()=>{document.documentElement.lang=language; if(!embedded)writeSetting('live-scores.language',language)},[language,embedded])
 useEffect(()=>{if(theme==='auto')delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=theme; if(!embedded)writeSetting('live-scores.theme',theme)},[theme,embedded])
 useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),30_000);return()=>clearInterval(timer)},[])
 useEffect(()=>{
  if(!embedded || !options.parentOrigin || window.parent===window)return
  try { if(new URL(document.referrer).origin!==options.parentOrigin)return } catch {return}
  const parentOrigin=options.parentOrigin
  const report = () => {
    const dialog = document.querySelector('[role="dialog"]')
    const drawerOpen = Boolean(document.querySelector('.side-drawer-backdrop'))
    const height = dialog ? 1000 : Math.max(240, Math.min(2200, Math.ceil(document.getElementById('root')?.scrollHeight || 600)))
    window.parent.postMessage({ type: 'standalone-app:resize', height, hasOpenLink: compact, drawerOpen }, parentOrigin)
  }
  const resize=new ResizeObserver(report);resize.observe(document.getElementById('root')!);
  const mutations=new MutationObserver(report);mutations.observe(document.body,{subtree:true,childList:true});report()
  return()=>{resize.disconnect();mutations.disconnect()}
 },[embedded,compact,options.parentOrigin])
 const appearanceControls = <div className="app-tools">
   <button type="button" aria-label={de?'Sprache wechseln':'Change language'} onClick={()=>setLanguage(language==='de'?'en':'de')}>{language.toUpperCase()}</button>
   <label className="app-theme">
   <svg className="app-theme-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8a4 4 0 1 0 4 4M12 2v2M2 12h2M4.9 4.9l1.4 1.4M4.9 19.1l1.4-1.4M20.5 13a7 7 0 0 1-9.5-9.5A9 9 0 1 0 20.5 13Z" /></svg>
   <span className="app-theme-value" aria-hidden="true">{theme === 'auto' ? 'Auto' : theme === 'light' ? de ? 'Hell' : 'Light' : de ? 'Dunkel' : 'Dark'}<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg></span>
   <select aria-label={de?'Darstellung':'Appearance'} value={theme} onChange={event=>setTheme(event.target.value as Theme)}>
     <option value="auto">Auto</option><option value="light">{de?'Hell':'Light'}</option><option value="dark">{de?'Dunkel':'Dark'}</option>
   </select></label>
 </div>
 return <div className={`standalone ${embedded?'is-embedded':''} ${compact?'is-compact':''} ${viewportDrawers?'has-viewport-drawers':''}`}>
  <h1 className="app-title">Live Scores</h1>
  {/* Reserved ad areas of the desktop browser view; hidden on phones and absent in dashboard embeds. */}
  {!embedded && <div className="ad-slot ad-slot-top" data-ad-slot="top" />}
  {!embedded && <div className="ad-slot ad-slot-left" data-ad-slot="left" />}
  {!apiBaseUrl && <aside className="connection-notice" role="status">{de?'Die Verbindung für vollständige Live-Daten ist noch nicht eingerichtet.':'The connection for complete live data has not been configured yet.'}</aside>}
  <main><SportsWidget language={language} now={now} compact={compact} appearanceControls={embedded ? undefined : appearanceControls} /></main>
  {!embedded && <div className="ad-slot ad-slot-right" data-ad-slot="right" />}
 </div>
}
