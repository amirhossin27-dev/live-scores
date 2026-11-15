import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { DetailStack, useDetailNavigation } from './DetailNavigation'

afterEach(cleanup)

it('ignores a late navigation callback from a covered or removed visit', () => {
  const callbacks = new Map<string, () => void>()
  function Visit({ name }: { name: string }) {
    const navigation = useDetailNavigation()!
    callbacks.set(name, () => navigation.push({ backLabel: name, content: <Visit name={`${name}-child`} /> }))
    return <><h3>{name}</h3><button onClick={callbacks.get(name)}>Open {name}</button><button onClick={navigation.back}>Back {name}</button></>
  }
  render(<DetailStack><Visit name="root" /></DetailStack>)
  fireEvent.click(screen.getByRole('button', { name: 'Open root' }))
  const closedVisit = callbacks.get('root-child')!
  const coveredVisit = callbacks.get('root')!
  act(coveredVisit)
  expect(screen.getByRole('heading').textContent).toBe('root-child')
  fireEvent.click(screen.getByRole('button', { name: 'Back root-child' }))
  act(closedVisit)
  expect(screen.getByRole('heading').textContent).toBe('root')
})
