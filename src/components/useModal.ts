import { useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'

interface Modal { element: HTMLElement; dismiss: () => void }
const modals: Modal[] = []
const savedInert = new Map<HTMLElement, boolean>()
let originalOverflow = ''
let originalRootOverflow = ''
function syncBackground() {
  const top = modals.at(-1)?.element
  for (const child of document.body.children) {
    if (!(child instanceof HTMLElement)) continue
    if (!savedInert.has(child)) savedInert.set(child, child.inert)
    child.inert = top ? !child.contains(top) : savedInert.get(child) ?? false
  }
  if (!top) {
    savedInert.forEach((value, element) => { element.inert = value })
    savedInert.clear()
  }
}
function isVisible(element: HTMLElement) {
  if (element.closest('[hidden], [inert]')) return false
  let ancestor: HTMLElement | null = element
  while (ancestor) {
    const style = getComputedStyle(ancestor)
    if (style.display === 'none' || style.visibility === 'hidden') return false
    ancestor = ancestor.parentElement
  }
  return true
}
const focusables = (element: HTMLElement) => [...element.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')].filter((item) => isVisible(item) && item.getAttribute('aria-hidden') !== 'true')

/** Shared modal ownership also covers body portals such as calendar and table form. */
export function useModal(ref: RefObject<HTMLElement | null>, open: boolean, dismiss: () => void, restoreFocus?: (element: HTMLElement) => void) {
  const latest = useRef({ dismiss, restoreFocus })
  latest.current = { dismiss, restoreFocus }
  useLayoutEffect(() => {
    const element = ref.current
    if (!open || !element) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const modal = { element, dismiss: () => latest.current.dismiss() }
    if (modals.length === 0) {
      originalOverflow = document.body.style.overflow
      originalRootOverflow = document.documentElement.style.overflow
      document.body.style.overflow = 'hidden'
      document.documentElement.style.overflow = 'hidden'
    }
    modals.push(modal)
    syncBackground()
    const observer = new MutationObserver(syncBackground)
    observer.observe(document.body, { childList: true })
    const focusFirst = () => (focusables(element)[0] ?? element).focus({ preventScroll: true })
    const onFocus = (event: FocusEvent) => {
      if (modals.at(-1) === modal && event.target instanceof Node && !element.contains(event.target)) focusFirst()
    }
    const onKey = (event: KeyboardEvent) => {
      if (modals.at(-1) !== modal) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        modal.dismiss()
      } else if (event.key === 'Tab') {
        const items = focusables(element)
        const index = items.indexOf(document.activeElement as HTMLElement)
        if (!items.length || (event.shiftKey ? index <= 0 : index < 0 || index === items.length - 1)) {
          event.preventDefault()
          ;(event.shiftKey ? items.at(-1) : items[0])?.focus({ preventScroll: true })
        }
      }
    }
    document.addEventListener('focusin', onFocus)
    document.addEventListener('keydown', onKey)
    focusFirst()
    return () => {
      observer.disconnect()
      document.removeEventListener('focusin', onFocus)
      document.removeEventListener('keydown', onKey)
      const index = modals.indexOf(modal)
      if (index >= 0) modals.splice(index, 1)
      syncBackground()
      if (!modals.length) {
        document.body.style.overflow = originalOverflow
        document.documentElement.style.overflow = originalRootOverflow
      }
      if (previous?.isConnected && !previous.closest('[hidden], [inert]')) {
        if (latest.current.restoreFocus) latest.current.restoreFocus(previous)
        else previous.focus({ preventScroll: true })
      }
    }
  }, [open, ref])
}
