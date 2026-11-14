import type { ReactNode } from 'react'
import { useEffect, useId } from 'react'
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissible) {
        onClose()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose, dismissible])

  return (
    <div className="side-drawer-backdrop" onMouseDown={(event) => {
      if (event.target !== event.currentTarget) return
      if (onBackdropClose) onBackdropClose()
      else if (dismissible) onClose()
    }}>
      <aside className={`side-drawer${wide ? ' is-wide' : ''}${aside ? ' is-split' : ''}${className ? ` ${className}` : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        {aside && <section className="side-drawer-aside">{aside}</section>}
        <div className="side-drawer-main">
          <header className="side-drawer-header">
            <div>
              <h2 id={titleId}>{title}</h2>
              {subtitle && <p>{subtitle}</p>}
            </div>
            <button type="button" className="side-drawer-close" aria-label={closeLabel} title={closeLabel} onClick={onClose}><span aria-hidden="true">×</span><span>{closeLabel}</span></button>
          </header>
          <div className="side-drawer-body">{children}</div>
          {footer && <footer className="side-drawer-footer">{footer}</footer>}
        </div>
      </aside>
    </div>
  )
}
