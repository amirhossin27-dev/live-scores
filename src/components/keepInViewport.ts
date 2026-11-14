import { useLayoutEffect } from 'react'
import type { RefObject } from 'react'

const margin = 8
const gap = 6

export interface AnchorBox {
  top: number
  bottom: number
}

/**
 * Keeps an opened pop-up menu completely on screen. After the menu is laid out it is measured: when it does not fit below
 * its trigger it opens above it, when it fits on neither side it takes the side with more room and scrolls inside, and it is
 * pushed in from the left and right edges. The menu is only moved with a transform, so it works for menus with
 * `position: fixed` as well as `absolute` ones.
 *
 * `anchor` is the trigger (an element, or its top and bottom in viewport coordinates); `prefer` is the side the menu opens
 * on when both fit; `open` and `key` re-run the measurement when the menu opens or changes its content.
 */
export function useKeepInViewport(
  menuRef: RefObject<HTMLElement | null>,
  { anchor, open, key = null, prefer = 'below' }: { anchor: RefObject<HTMLElement | null> | AnchorBox | null; open: boolean; key?: unknown; prefer?: 'below' | 'above' },
) {
  useLayoutEffect(() => {
    const menu = menuRef.current
    if (!open || !menu) return undefined

    function place() {
      if (!menu) return
      menu.style.transform = ''
      menu.style.maxHeight = ''
      menu.style.overflowY = ''
      const box = anchor && 'current' in anchor ? anchor.current?.getBoundingClientRect() ?? null : anchor
      const rect = menu.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth
      let top = rect.top

      if (box) {
        const below = viewportHeight - margin - (box.bottom + gap)
        const above = box.top - gap - margin
        const fitsBelow = rect.height <= below
        const fitsAbove = rect.height <= above
        if (fitsBelow && (prefer === 'below' || !fitsAbove)) top = box.bottom + gap
        else if (fitsAbove) top = box.top - gap - rect.height
        else if (above > below) {
          menu.style.maxHeight = `${above}px`
          menu.style.overflowY = 'auto'
          top = margin
        } else {
          menu.style.maxHeight = `${below}px`
          menu.style.overflowY = 'auto'
          top = box.bottom + gap
        }
      } else if (rect.bottom > viewportHeight - margin) {
        top = Math.max(margin, viewportHeight - margin - rect.height)
      }

      const height = menu.getBoundingClientRect().height
      top = Math.min(Math.max(margin, top), Math.max(margin, viewportHeight - margin - height))
      const left = Math.min(Math.max(margin, rect.left), Math.max(margin, viewportWidth - margin - rect.width))
      const dx = Math.round(left - rect.left)
      const dy = Math.round(top - rect.top)
      if (dx !== 0 || dy !== 0) menu.style.transform = `translate(${dx}px, ${dy}px)`
    }

    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [menuRef, anchor, open, key, prefer])
}
