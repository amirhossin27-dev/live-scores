import { useId, useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

export interface SportsTab<T extends string> {
  id: T
  label: string
}

interface Props<T extends string> {
  tabs: SportsTab<T>[]
  active: T
  label: string
  onSelect: (id: T) => void
  children: ReactNode
}

/**
 * The tabs of a sports panel (WAI-ARIA tabs): only the active tab is in the tab order, the arrow keys, Home and End
 * move between the tabs and show them at once. With a single tab only its content is shown.
 */
export function SportsTabs<T extends string>({ tabs, active, label, onSelect, children }: Props<T>) {
  const id = useId()
  const list = useRef<HTMLDivElement>(null)
  if (tabs.length < 2) return <div>{children}</div>

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const index = tabs.findIndex((tab) => tab.id === active)
    const next = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: tabs.length - 1 }[event.key]
    if (next === undefined) return
    event.preventDefault()
    const target = (next + tabs.length) % tabs.length
    onSelect(tabs[target].id)
    list.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[target]?.focus()
  }

  return (
    <>
      <div ref={list} className="sp-filter md-tabs" role="tablist" aria-label={label}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`${id}-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={tab.id === active}
            aria-controls={`${id}-panel`}
            tabIndex={tab.id === active ? 0 : -1}
            className={tab.id === active ? 'active' : ''}
            onClick={() => onSelect(tab.id)}
            onKeyDown={onKeyDown}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${active}`}>{children}</div>
    </>
  )
}
