import { useSyncExternalStore } from 'react'

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

/** Returns the current route, e.g. "" (home), "A" (letter), "reglages". */
export function useHashRoute(): string {
  return useSyncExternalStore(subscribe, () => decodeURIComponent(location.hash.replace(/^#\/?/, '')))
}

let navigatedInApp = false

export const navigate = (route: string, { replace = false } = {}) => {
  const hash = route ? `#/${route}` : '#/'
  if (replace) {
    location.replace(hash)
    return
  }
  navigatedInApp = true
  location.hash = hash
}

/** Go back if we came from inside the app (keeps the phone back gesture
 *  consistent), otherwise go to `fallback` — e.g. when a page was opened directly. */
export const goBack = (fallback = '') => {
  if (navigatedInApp) history.back()
  else navigate(fallback, { replace: true })
}
