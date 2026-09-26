import { useCallback, useEffect, useState } from 'react'
import { api, ApiError, type DateEntry, type Settings } from './api'
import { useHashRoute } from './useHashRoute'
import Login from './components/Login'
import Home from './components/Home'
import Detail from './components/Detail'
import SettingsPage from './components/SettingsPage'

type Auth = 'loading' | 'in' | 'out'

export default function App() {
  const route = useHashRoute()
  const [auth, setAuth] = useState<Auth>('loading')
  const [dates, setDates] = useState<DateEntry[] | null>(null)
  const [settings, setSettings] = useState<Settings>({ person1: 'Moi', person2: 'Elle' })
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [d, s] = await Promise.all([api.dates(), api.settings()])
      setDates(d)
      setSettings(s)
      setError(null)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setAuth('out')
      else setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    api
      .me()
      .then((m) => setAuth(m.authenticated ? 'in' : 'out'))
      .catch(() => setAuth('in')) // offline: try to show what we can
  }, [])

  useEffect(() => {
    if (auth === 'in') refresh()
  }, [auth, refresh])

  if (auth === 'loading') return <Splash />
  if (auth === 'out') return <Login onLoggedIn={() => setAuth('in')} />
  if (!dates) return error ? <ErrorScreen message={error} onRetry={refresh} /> : <Splash />

  if (route === 'reglages') {
    return (
      <SettingsPage
        settings={settings}
        onSaved={refresh}
        onLoggedOut={() => {
          setDates(null)
          setAuth('out')
        }}
      />
    )
  }

  const current = dates.find((d) => d.letter === route.toUpperCase())
  if (current) return <Detail key={current.letter} entry={current} settings={settings} onChanged={refresh} />

  return <Home dates={dates} settings={settings} />
}

function Splash() {
  return (
    <div className="splash">
      <span className="splash-letters">A · Z</span>
    </div>
  )
}

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="splash">
      <p className="error">{message}</p>
      <button className="btn" onClick={onRetry}>
        Réessayer
      </button>
    </div>
  )
}
