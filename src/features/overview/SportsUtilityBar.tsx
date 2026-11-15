import { useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'

interface SportsUtilityBarProps {
  label: string
  status: ReactNode
  children: ReactNode
  onHeightChange: (height: number) => void
}

/** Its measured height is reserved by the overview, including wrapped text and device insets. */
export function SportsUtilityBar({ label, status, children, onHeightChange }: SportsUtilityBarProps) {
  const bar = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const element = bar.current
    if (!element) return
    const measure = () => {
      const height = Math.ceil(element.getBoundingClientRect().height)
      if (height > 0) onHeightChange(height)
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(element)
    window.addEventListener('resize', measure)
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure) }
  }, [onHeightChange])
  return <nav ref={bar} className="sp-utility-bar" aria-label={label}>
    <div className="sp-utility-inner">{status}<div className="sp-utility-controls">{children}</div></div>
  </nav>
}
