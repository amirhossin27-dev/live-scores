import type { ReactNode } from 'react'
import { useId, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useDetailNavigation } from './DetailNavigation'
import { useModal } from './useModal'
import './SideDrawer.css'

interface SideDrawerProps {
  title: string
  subtitle?: string
  closeLabel: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  /** Optional class for a feature-specific panel layout. */
  className?: string
  /** Wider panel for editing masks. */
  wide?: boolean
  /** When false, Escape and a click on the backdrop do not close the panel (editing masks keep unsaved input). */
  dismissible?: boolean
  /** Called on a click on the backdrop even when the panel is not dismissible (the mask decides, e.g. asks about unsaved input). */
  onBackdropClose?: () => void
  /** Optional second half shown left of the panel (e.g. a process chart); the panel then spans most of the screen. */
  aside?: ReactNode
}

/** Panel that slides in from the right edge, like the detail panels of GitHub; closes on Escape or a click on the backdrop. */
export function SideDrawer({ title, subtitle, closeLabel, onClose, children, footer, className = '', wide = false, dismissible = true, onBackdropClose, aside }: SideDrawerProps) {
  const titleId = useId()

  const origin = useRef<HTMLSpanElement>(null)
  const backdrop = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    // Body portals retain the app's explicit inset overrides in both embed modes.
    for (const edge of ['top', 'right', 'bottom', 'left']) {
      const property = `--app-safe-${edge}`
      let ancestor: HTMLElement | null = origin.current
      while (ancestor) {
        const value = getComputedStyle(ancestor).getPropertyValue(property).trim()
        if (value) { backdrop.current?.style.setProperty(property, value); break }
        ancestor = ancestor.parentElement
      }
    }
  })
  const navigation = useDetailNavigation()
  useModal(backdrop, true, () => {
    if (!dismissible) return
    if (navigation?.depth) navigation.back()
    else onClose()
  })

  return <><span ref={origin} hidden />{createPortal(
    <div ref={backdrop} className="side-drawer-backdrop" onMouseDown={(event) => {
      if (event.target !== event.currentTarget) return
      if (onBackdropClose) onBackdropClose()
      else if (dismissible) onClose()
    }}>
      <aside className={`side-drawer${wide ? ' is-wide' : ''}${aside ? ' is-split' : ''}${className ? ` ${className}` : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        {aside && <section className="side-drawer-aside">{aside}</section>}
        <div className="side-drawer-main">
          <header className="side-drawer-header">
            <div>
              <h2 id={titleId}>{navigation?.title ?? title}</h2>
              {subtitle && <p>{subtitle}</p>}
            </div>
            <nav className="side-drawer-actions" aria-label={closeLabel}>
            {navigation?.depth ? <button type="button" className="side-drawer-back" onClick={navigation.back}>‹ {navigation.backLabel}</button> : null}
            <button type="button" className="side-drawer-close" aria-label={closeLabel} title={closeLabel} onClick={onClose}><span aria-hidden="true">×</span><span>{closeLabel}</span></button>
            </nav>
          </header>
          <div className="side-drawer-body">{children}</div>
          {footer && <footer className="side-drawer-footer">{footer}</footer>}
        </div>
      </aside>
    </div>, document.body,
  )}</>
}
