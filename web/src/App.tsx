import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError, type Entry, type Settings } from './api'
import { useHashRoute } from './useHashRoute'
import Login from './components/Login'
import Home from './components/Home'
import LetterPage from './components/LetterPage'
import EntryPage from './components/EntryPage'
import SettingsPage from './components/SettingsPage'
import Surprise from './components/Surprise'
import Celebration from './components/Celebration'
import AlbumPage from './components/AlbumPage'
import { LETTERS } from './letters'
import { markSurpriseSeen, surpriseSeen } from './surprise'

type Auth = 'loading' | 'in' | 'out'

export default function App() {
  const route = useHashRoute()
  const [auth, setAuth] = useState<Auth>('loading')
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [settings, setSettings] = useState<Settings>({ person1: 'Anaïs', person2: 'Laïla', since: '' })
  const [error, setError] = useState<string | null>(null)
  const [showSurprise, setShowSurprise] = useState(() => !surpriseSeen())
  const [celebrate, setCelebrate] = useState<{ letter: string; done: number } | null>(null)
  const closeCelebration = useCallback(() => setCelebrate(null), [])

  // Celebrate when a letter gets its first done date (not on the first load).
  const doneLetters = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (!entries) return
    const now = new Set(entries.filter((e) => e.done).map((e) => e.letter))
    const before = doneLetters.current
    doneLetters.current = now
    if (!before) return
    const newly = [...now].find((l) => !before.has(l))
    if (newly) setCelebrate({ letter: newly, done: now.size })
  }, [entries])

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
  if (showSurprise) {
    return (
      <Surprise
        onDone={() => {
          markSurpriseSeen()
          setShowSurprise(false)
        }}
      />
    )
  }
  if (!entries) return error ? <ErrorScreen message={error} onRetry={refresh} /> : <Splash />

  return (
    <>
      {renderPage()}
      {celebrate && (
        <Celebration letter={celebrate.letter} done={celebrate.done} total={LETTERS.length} onClose={closeCelebration} />
      )}
    </>
  )

  function renderPage() {
    if (!entries) return null
    if (route === 'album') return <AlbumPage entries={entries} />
    if (route === 'reglages') {
      return (
        <SettingsPage
          settings={settings}
          onSaved={refresh}
          onReplaySurprise={() => {
            markSurpriseSeen(false)
            setShowSurprise(true)
          }}
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
        return <EntryPage key={m[2]} letter={letter} entry={entry} onChanged={refresh} />
      }
    }

    return <Home entries={entries} settings={settings} />
  }
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
