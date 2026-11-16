import { useEffect } from 'react'
import { syncPush, type PushFavorite } from './pushClient'

/** Sends the favourites to the push worker at start and after every change (1 s debounce), while notifications are on. */
export function usePushSync(favorites: PushFavorite[], competitions: string[], active: boolean) {
  const key = JSON.stringify([favorites.map((item) => [item.competition, item.id, item.start]), competitions])
  useEffect(() => {
    if (!active) return
    const timer = window.setTimeout(() => { void syncPush(favorites, competitions).catch(() => undefined) }, 1000)
    return () => window.clearTimeout(timer)
    // The key stands for the lists.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, active])
}
