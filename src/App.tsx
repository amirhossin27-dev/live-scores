import { useEffect, useState } from 'react'
import { SportsWidget } from './features/overview/SportsWidget'
import { apiBaseUrl } from './services/platformApi'
import { readViewOptions, readSetting, writeSetting } from './runtime.mjs'
import type { Language } from './types/platform'
import './app.css'
const options = readViewOptions(window.location.href)
export function App() {
 const { embedded,compact } = options
 const [language,setLanguage] = useState<Language>(()=>embedded ? options.language : readSetting('live-scores.language','de',['de','en']))
 const [theme,setTheme] = useState(()=>embedded ? options.theme : readSetting('live-scores.theme','auto',['auto','dark','light']))
 const [now,setNow] = useState(()=>new Date())
 const de = language === 'de'
 useEffect(()=>{document.documentElement.lang=language; if(!embedded)writeSetting('live-scores.language',language)},[language,embedded])
 useEffect(()=>{if(theme==='auto')delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=theme; if(!embedded)writeSetting('live-scores.theme',theme)},[theme,embedded])
 useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),30_000);return()=>clearInterval(timer)},[])
 useEffect(()=>{
  if(!embedded || !options.parentOrigin || window.parent===window)return
  // Referrer must agree with the explicitly supplied parent. No wildcard messages.
  try { if(new URL(document.referrer).origin!==options.parentOrigin)return } catch {return}
  const parentOrigin=options.parentOrigin
  const report=()=>{const dialog=Boolean(document.querySelector('[role="dialog"]')); const height=dialog?1000:Math.max(240,Math.min(2200,Math.ceil(document.getElementById('root')?.scrollHeight || 600))); window.parent.postMessage({type:'standalone-app:resize',height},parentOrigin)}
  const resize=new ResizeObserver(report);resize.observe(document.getElementById('root')!);
  const mutations=new MutationObserver(report);mutations.observe(document.body,{subtree:true,childList:true});report()
  return()=>{resize.disconnect();mutations.disconnect()}
 },[embedded])
 return <div className={`standalone ${embedded?'is-embedded':''} ${compact?'is-compact':''}`}>
  {!embedded && <header className="app-header"><div className="brand"><img src="./icons/icon-192.png" alt=""/><div><span className="app-eyebrow">{de?'DEINE ÜBERSICHT':'YOUR OVERVIEW'}</span><h1>Live Scores</h1></div></div><div className="app-actions"><button type="button" aria-label={de?'Sprache wechseln':'Change language'} onClick={()=>setLanguage(language==='de'?'en':'de')}>{language.toUpperCase()}</button><select aria-label={de?'Darstellung':'Appearance'} value={theme} onChange={event=>setTheme(event.target.value)}><option value="auto">{de?'Automatisch':'Automatic'}</option><option value="light">{de?'Hell':'Light'}</option><option value="dark">{de?'Dunkel':'Dark'}</option></select></div></header>}
  {!apiBaseUrl && <aside className="connection-notice" role="status">{de?'Die Verbindung für vollständige Live-Daten ist noch nicht eingerichtet.':'The connection for complete live data has not been configured yet.'}</aside>}
  <main>{<SportsWidget language={language} now={now} />}</main>
 </div>
}
