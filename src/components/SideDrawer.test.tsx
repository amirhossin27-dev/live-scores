import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { SideDrawer } from './SideDrawer'

afterEach(cleanup)

describe('SideDrawer exits', () => {
  it('provides a visible text exit even when the content is still loading', () => {
    function Harness() {
      const [open, setOpen] = useState(true)
      return open
        ? <SideDrawer title="Spiel" closeLabel="Zur Übersicht" onClose={() => setOpen(false)}><p>Wird geladen …</p></SideDrawer>
        : <p>Ergebnisliste</p>
    }
    render(<Harness />)
    const exit = screen.getByRole('button', { name: 'Zur Übersicht' })
    expect(exit.textContent).toContain('Zur Übersicht')
    fireEvent.click(exit)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('Ergebnisliste')).toBeTruthy()
  })
})

it('moves focus inside, blocks the background and restores the trigger after closing', () => {
  function Harness() {
    const [open, setOpen] = useState(false)
    return <><button onClick={() => setOpen(true)}>Öffnen</button>{open && <SideDrawer title="Spiel" closeLabel="Zur Übersicht" onClose={() => setOpen(false)}><button>Inhalt</button></SideDrawer>}</>
  }
  render(<Harness />)
  const trigger = screen.getByRole('button', { name: 'Öffnen' })
  trigger.focus()
  fireEvent.click(trigger)
  const dialog = screen.getByRole('dialog')
  expect(dialog.contains(document.activeElement)).toBe(true)
  expect(document.body.style.overflow).toBe('hidden')
  const last = screen.getByRole('button', { name: 'Inhalt' })
  last.focus()
  fireEvent.keyDown(last, { key: 'Tab' })
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Zur Übersicht' }))
  trigger.focus()
  expect(dialog.contains(document.activeElement)).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Zur Übersicht' }))
  expect(document.activeElement).toBe(trigger)
  expect(document.body.style.overflow).not.toBe('hidden')
})

it('preserves the embedding safe-area override after portalling outside the app', () => {
  render(<div style={{ '--app-safe-top': '0px' } as import('react').CSSProperties}><SideDrawer title="Embedded" closeLabel="Close" onClose={() => {}}>Content</SideDrawer></div>)
  expect((document.querySelector('.side-drawer-backdrop') as HTMLElement).style.getPropertyValue('--app-safe-top')).toBe('0px')
})
