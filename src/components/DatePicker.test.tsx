import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DatePicker } from './DatePicker'

function Harness({ initial = '', ...props }: { initial?: string; min?: string; allowClear?: boolean; language?: 'en' | 'de'; onSelect?: (value: string) => void }) {
  const [value, setValue] = useState(initial)
  return <DatePicker label="Deadline" value={value} language={props.language ?? 'en'} min={props.min} allowClear={props.allowClear} onChange={(next) => { setValue(next); props.onSelect?.(next) }} />
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('DatePicker', () => {
  it('shows a readable placeholder instead of the native TT.MM.JJJJ mask', () => {
    render(<Harness language="de" />)

    expect(screen.getByRole('button', { name: 'Deadline' }).textContent).toBe('Datum wählen')
    expect(document.querySelector('input[type="date"]')).toBeNull()
  })

  it('formats the selected date for the language', () => {
    const { unmount } = render(<Harness initial="2026-10-15" language="de" />)
    expect(screen.getByRole('button', { name: 'Deadline' }).textContent).toBe('15.10.2026')
    unmount()
    render(<Harness initial="2026-10-15" language="en" />)
    expect(screen.getByRole('button', { name: 'Deadline' }).textContent).toBe('15/10/2026')
  })

  it('opens on the current month and highlights today and the month', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 4, 12))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Harness language="de" />)

    await user.click(screen.getByRole('button', { name: 'Deadline' }))

    const dialog = screen.getByRole('dialog')
    const month = within(dialog).getByText('Oktober 2026')
    expect(month.className).toContain('is-current')
    const today = within(dialog).getByRole('button', { name: /^[^,]+, 4\. Oktober 2026$/ })
    expect(today.className).toContain('is-today')
    expect(today.getAttribute('aria-current')).toBe('date')
    expect(within(dialog).getAllByText('Mo').length).toBeGreaterThan(0)
  })

  it('opens on the month of the selected value and navigates between months', async () => {
    const user = userEvent.setup()
    render(<Harness initial="2027-01-20" language="en" />)

    await user.click(screen.getByRole('button', { name: 'Deadline' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('January 2027').className).not.toContain('is-current')
    expect(within(dialog).getByRole('button', { name: /20 January 2027/ }).getAttribute('aria-pressed')).toBe('true')

    await user.click(within(dialog).getByRole('button', { name: 'Next month' }))
    expect(within(dialog).getByText('February 2027')).toBeTruthy()
    await user.click(within(dialog).getByRole('button', { name: 'Previous month' }))
    await user.click(within(dialog).getByRole('button', { name: 'Previous month' }))
    expect(within(dialog).getByText('December 2026')).toBeTruthy()
  })

  it('selects a day, closes and reports ISO format', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<Harness initial="2026-10-15" onSelect={onSelect} />)

    await user.click(screen.getByRole('button', { name: 'Deadline' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /22 October 2026/ }))

    expect(onSelect).toHaveBeenCalledWith('2026-10-22')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: 'Deadline' }).textContent).toBe('22/10/2026')
  })

  it('disables days before the minimum and can clear the value', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<Harness initial="2026-10-15" min="2026-10-10" allowClear onSelect={onSelect} />)

    await user.click(screen.getByRole('button', { name: 'Deadline' }))
    const dialog = screen.getByRole('dialog')
    expect((within(dialog).getByRole('button', { name: /(^|\s)9 October 2026$/ }) as HTMLButtonElement).disabled).toBe(true)
    expect((within(dialog).getByRole('button', { name: /(^|\s)10 October 2026$/ }) as HTMLButtonElement).disabled).toBe(false)

    await user.click(within(dialog).getByRole('button', { name: 'Clear' }))
    expect(onSelect).toHaveBeenCalledWith('')
    expect(screen.getByRole('button', { name: 'Deadline' }).textContent).toBe('Select date')
  })

  it('closes with Escape or a click outside and does not clear without allowClear', async () => {
    const user = userEvent.setup()
    render(<Harness initial="2026-10-15" />)

    await user.click(screen.getByRole('button', { name: 'Deadline' }))
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Deadline' }))
    await user.click(document.body)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
