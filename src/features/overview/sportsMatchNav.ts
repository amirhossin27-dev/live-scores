import { createContext, useContext } from 'react'

/** A FotMob match to open in the side panel, and the label of the way back ("Back to the table"). */
export interface MatchTarget {
  fotmob: string
  back: string
}

export const OpenMatchContext = createContext<((target: MatchTarget) => void) | null>(null)

/**
 * Opens a FotMob match (team page, profile, form in a table) as a new layer of the side panel; the layer below stays as it was
 * and comes back with "back". Null outside a panel that can show matches.
 */
export function useOpenMatch() {
  return useContext(OpenMatchContext)
}
