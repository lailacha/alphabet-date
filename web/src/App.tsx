import { useCallback, useEffect, useState } from 'react'
import { api, ApiError, type Entry, type Settings } from './api'
import { useHashRoute } from './useHashRoute'
import Login from './components/Login'
import Home from './components/Home'
import LetterPage from './components/LetterPage'
import EntryPage from './components/EntryPage'
import SettingsPage from './components/SettingsPage'

type Auth = 'loading' | 'in' | 'out'

export default function App() {
  const route = useHashRoute()
  const [auth, setAuth] = useState<Auth>('loading')
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [settings, setSettings] = useState<Settings>({ person1: 'Moi', person2: 'Elle' })
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [e, s] = await Promise.all([api.entries(), api.settings()])
      setEntries(e)
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
  if (!entries) return error ? <ErrorScreen message={error} onRetry={refresh} /> : <Splash />

  if (route === 'reglages') {
    return (
      <SettingsPage
        settings={settings}
        onSaved={refresh}
        onLoggedOut={() => {
          setEntries(null)
          setAuth('out')
        }}
      />
    )
  }

  // Routes: "A" = letter page, "A/12" = a date, "A/nouveau" = new date.
  const m = route.match(/^([A-Za-z])(?:\/(\d+|nouveau))?$/)
  if (m) {
    const letter = m[1].toUpperCase()
    if (!m[2]) return <LetterPage key={letter} letter={letter} entries={entries} />
    const entry = m[2] === 'nouveau' ? null : entries.find((e) => e.id === Number(m[2]))
    if (entry !== undefined) {
      return <EntryPage key={m[2]} letter={letter} entry={entry} settings={settings} onChanged={refresh} />
    }
  }

  return <Home entries={entries} settings={settings} />
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
