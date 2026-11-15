import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

interface Destination { content: ReactNode; backLabel: string; title?: string }
interface Entry extends Destination { key: number; scroll: number; focus: HTMLElement | null }
interface Navigation {
  push: (destination: Destination) => void
  back: () => void
  backLabel?: string
  title?: string
  depth: number
  framed: boolean
  active: boolean
  visit: number | null
  setTitle: (visit: number | null, title: string) => void
}
const DetailContext = createContext<Navigation | null>(null)
export const useDetailNavigation = () => useContext(DetailContext)

/** A single visit stack. Covered views stay mounted, including their child selections. */
export function DetailStack({ children, frame }: { children: ReactNode; frame?: (content: ReactNode) => ReactNode }) {
  const [entries, setEntries] = useState<Entry[]>([])
  const entriesRef = useRef(entries)
  entriesRef.current = entries
  const host = useRef<HTMLDivElement>(null)
  const next = useRef(0)
  const restore = useRef<{ scroll: number; focus: HTMLElement | null } | null>(null)
  const scroller = () => host.current?.closest<HTMLElement>('.side-drawer-body') ?? null
  const push = (destination: Destination, source: number | null = entriesRef.current.at(-1)?.key ?? null) => {
    // A request/callback owned by a covered or removed visit cannot create a new active view.
    if ((entriesRef.current.at(-1)?.key ?? null) !== source) return
    const entry = { ...destination, key: next.current++, scroll: scroller()?.scrollTop ?? 0, focus: document.activeElement instanceof HTMLElement ? document.activeElement : null }
    restore.current = { scroll: 0, focus: null }
    entriesRef.current = [...entriesRef.current, entry]
    setEntries(entriesRef.current)
  }
  const back = () => {
    const current = entriesRef.current.at(-1)
    if (!current) return
    restore.current = { scroll: current.scroll, focus: current.focus }
    entriesRef.current = entriesRef.current.slice(0, -1)
    setEntries(entriesRef.current)
  }
  useLayoutEffect(() => {
    const target = restore.current
    if (!target) return
    restore.current = null
    const element = scroller()
    if (element) element.scrollTop = target.scroll
    if (target.focus?.isConnected && !target.focus.closest('[hidden]')) target.focus.focus({ preventScroll: true })
    else element?.closest('.side-drawer')?.querySelector<HTMLButtonElement>('.side-drawer-back, .side-drawer-close')?.focus({ preventScroll: true })
  }, [entries.length])
  const setTitle = useCallback((visit: number | null, title: string) => {
    const entry = entriesRef.current.find((item) => item.key === visit)
    if (!entry || entry.title === title) return
    entriesRef.current = entriesRef.current.map((item) => item.key === visit ? { ...item, title } : item)
    setEntries(entriesRef.current)
  }, [])
  const top = entries.at(-1)
  const navigation: Navigation = { push, back, depth: entries.length, framed: Boolean(frame), active: true, visit: top?.key ?? null, setTitle, backLabel: top?.backLabel, title: [...entries].reverse().find((entry) => entry.title)?.title }
  const content = <div ref={host} className="md-layers">
    <DetailContext.Provider value={{ ...navigation, push: (destination) => push(destination, null), visit: null, active: entries.length === 0 }}><div hidden={entries.length > 0}>{children}</div></DetailContext.Provider>
    {entries.map((entry, index) => <DetailContext.Provider key={entry.key} value={{ ...navigation, push: (destination) => push(destination, entry.key), visit: entry.key, active: index === entries.length - 1 }}><div hidden={index !== entries.length - 1}>{entry.content}</div></DetailContext.Provider>)}
  </div>
  return <DetailContext.Provider value={navigation}>{frame ? frame(content) : content}</DetailContext.Provider>
}

/** Profiles also work in isolated/embedded callers without a drawer. */
export function DetailBoundary({ children }: { children: ReactNode }) {
  return useDetailNavigation() ? children : <DetailStack>{children}</DetailStack>
}

export function DetailBack({ onBack, label }: { onBack?: () => void; label: string }) {
  const navigation = useDetailNavigation()
  if (navigation?.framed || !onBack) return null
  return <button type="button" className="sp-text-button pp-back" onClick={onBack}>‹ {label}</button>
}

/** The resolved match supplies its own heading without changing its place in the stack. */
export function useDetailTitle(title: string | null) {
  const navigation = useDetailNavigation()
  const visit = navigation?.visit ?? null
  const setTitle = navigation?.setTitle
  useLayoutEffect(() => { if (title) setTitle?.(visit, title) }, [title, visit, setTitle])
}
