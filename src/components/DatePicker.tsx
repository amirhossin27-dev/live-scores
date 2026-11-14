import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Language } from '../types/platform'
import './DatePicker.css'

interface DatePickerProps {
  /** Calendar date as YYYY-MM-DD, or an empty string. */
  value: string
  onChange: (value: string) => void
  language: Language
  /** Accessible name of the field. */
  label: string
  min?: string
  max?: string
  disabled?: boolean
  allowClear?: boolean
  /** Extra classes for the trigger button. */
  className?: string
  /** Text shown in the trigger instead of the formatted date. */
  display?: string
  /** Text of the empty field (default "Datum wählen" / "Select date"). */
  placeholder?: string
  showIcon?: boolean
  /** Own content of the trigger instead of the date text (e.g. "Today" over the date). */
  children?: ReactNode
}

const popoverWidth = 288
const popoverHeight = 342

function toIso(year: number, month: number, day: number) {
  return `${String(year).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function parseIso(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return match ? { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) } : null
}

function localeOf(language: Language) {
  return language === 'de' ? 'de-DE' : 'en-GB'
}

function formatPickerDate(value: string, language: Language) {
  const parsed = parseIso(value)
  if (!parsed) {
    return ''
  }

  return new Intl.DateTimeFormat(localeOf(language), { day: '2-digit', month: '2-digit', year: 'numeric' })
    .format(new Date(parsed.year, parsed.month, parsed.day))
}

export function DatePicker({
  value,
  onChange,
  language,
  label,
  min,
  max,
  disabled = false,
  allowClear = false,
  className = '',
  display,
  placeholder,
  showIcon = true,
  children,
}: DatePickerProps) {
  const trigger = useRef<HTMLButtonElement>(null)
  const popover = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const [view, setView] = useState(() => {
    const parsed = parseIso(value)
    const now = new Date()
    return { year: parsed?.year ?? now.getFullYear(), month: parsed?.month ?? now.getMonth() }
  })

  const copy = language === 'de'
    ? { placeholder: 'Datum wählen', today: 'Heute', clear: 'Löschen', previous: 'Vorheriger Monat', next: 'Nächster Monat' }
    : { placeholder: 'Select date', today: 'Today', clear: 'Clear', previous: 'Previous month', next: 'Next month' }

  const today = new Date()
  const todayIso = toIso(today.getFullYear(), today.getMonth(), today.getDate())
  const isCurrentMonth = view.year === today.getFullYear() && view.month === today.getMonth()

  const weekdays = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(localeOf(language), { weekday: 'short' })
    // 2024-01-01 is a Monday; weeks start on Monday in both languages.
    return Array.from({ length: 7 }, (_, index) => formatter.format(new Date(2024, 0, 1 + index)).replace('.', '').slice(0, 2))
  }, [language])

  const days = useMemo(() => {
    const firstWeekday = (new Date(view.year, view.month, 1).getDay() + 6) % 7
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(view.year, view.month, 1 - firstWeekday + index)
      return { iso: toIso(date.getFullYear(), date.getMonth(), date.getDate()), day: date.getDate(), outside: date.getMonth() !== view.month, date }
    })
  }, [view.month, view.year])

  const monthLabel = new Intl.DateTimeFormat(localeOf(language), { month: 'long', year: 'numeric' })
    .format(new Date(view.year, view.month, 1))

  function openPicker() {
    const parsed = parseIso(value)
    const now = new Date()
    setView({ year: parsed?.year ?? now.getFullYear(), month: parsed?.month ?? now.getMonth() })
    if (trigger.current) {
      const rect = trigger.current.getBoundingClientRect()
      const opensUpward = rect.bottom + popoverHeight > window.innerHeight && rect.top > popoverHeight
      setPosition({
        top: opensUpward
          ? Math.max(8, rect.top - popoverHeight - 6)
          : Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - popoverHeight - 8)),
        left: Math.max(8, Math.min(rect.left, window.innerWidth - popoverWidth - 8)),
      })
    }

    setOpen(true)
  }

  useEffect(() => {
    if (!open) {
      return undefined
    }

    function closeOutside(event: MouseEvent) {
      const target = event.target as Node | null
      if (target && !popover.current?.contains(target) && !trigger.current?.contains(target)) {
        setOpen(false)
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        trigger.current?.focus()
      }
    }

    function close() {
      setOpen(false)
    }

    document.addEventListener('mousedown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('mousedown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])

  function select(iso: string) {
    onChange(iso)
    setOpen(false)
    trigger.current?.focus()
  }

  function shiftMonth(delta: number) {
    setView((current) => {
      const date = new Date(current.year, current.month + delta, 1)
      return { year: date.getFullYear(), month: date.getMonth() }
    })
  }

  const text = display ?? (value ? formatPickerDate(value, language) : placeholder ?? copy.placeholder)
  const isPlaceholder = display === undefined && !value
  const todayDisabled = Boolean((min && todayIso < min) || (max && todayIso > max))

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={`date-picker-trigger${isPlaceholder ? ' is-placeholder' : ''}${className ? ` ${className}` : ''}`}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openPicker())}
      >
        {children ?? <span className="date-picker-text">{text}</span>}
        {showIcon && (
          <svg className="date-picker-icon" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
            <path d="M3.5 10h17M8 3v4M16 3v4" />
          </svg>
        )}
      </button>
      {open && createPortal(
        <div
          ref={popover}
          className="date-picker-popover"
          role="dialog"
          aria-label={label}
          style={{ top: position.top, left: position.left, width: popoverWidth }}
        >
          <div className="date-picker-header">
            <button type="button" className="date-picker-nav" aria-label={copy.previous} onClick={() => shiftMonth(-1)}>‹</button>
            <strong className={`date-picker-month${isCurrentMonth ? ' is-current' : ''}`} aria-live="polite">{monthLabel}</strong>
            <button type="button" className="date-picker-nav" aria-label={copy.next} onClick={() => shiftMonth(1)}>›</button>
          </div>
          <div className="date-picker-grid" role="grid">
            {weekdays.map((weekday, index) => <span className="date-picker-weekday" key={index} aria-hidden="true">{weekday}</span>)}
            {days.map((entry) => {
              const isSelected = entry.iso === value
              const isDisabled = Boolean((min && entry.iso < min) || (max && entry.iso > max))
              return (
                <button
                  type="button"
                  key={entry.iso}
                  className={`date-picker-day${entry.outside ? ' is-outside' : ''}${entry.iso === todayIso ? ' is-today' : ''}${isSelected ? ' is-selected' : ''}`}
                  aria-label={new Intl.DateTimeFormat(localeOf(language), { dateStyle: 'full' }).format(entry.date)}
                  aria-pressed={isSelected}
                  aria-current={entry.iso === todayIso ? 'date' : undefined}
                  disabled={isDisabled}
                  onClick={() => select(entry.iso)}
                >
                  {entry.day}
                </button>
              )
            })}
          </div>
          <div className="date-picker-footer">
            <button type="button" disabled={todayDisabled} onClick={() => select(todayIso)}>{copy.today}</button>
            {allowClear && <button type="button" onClick={() => select('')}>{copy.clear}</button>}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
