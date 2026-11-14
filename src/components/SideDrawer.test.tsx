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
