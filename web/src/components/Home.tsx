import { useState } from 'react'
import type { DateEntry, Settings } from '../api'
import { navigate } from '../useHashRoute'

type Filter = 'all' | 'done' | 'todo'

const FILTER_KEY = 'ad-filter'
const loadFilter = (): Filter => {
  try {
    const f = localStorage.getItem(FILTER_KEY)
    return f === 'done' || f === 'todo' ? f : 'all'
  } catch {
    return 'all'
  }
}

export default function Home({ dates, settings }: { dates: DateEntry[]; settings: Settings }) {
  const [filter, setFilterState] = useState<Filter>(loadFilter)
  const setFilter = (f: Filter) => {
    setFilterState(f)
    try {
      localStorage.setItem(FILTER_KEY, f)
    } catch {
      /* private mode */
    }
  }

  const done = dates.filter((d) => d.doneOn)
  const todo = dates.filter((d) => !d.doneOn)
  const shown = filter === 'done' ? done : filter === 'todo' ? todo : dates

  const pickRandom = () => {
    const withIdea = todo.filter((d) => d.idea)
    const pool = withIdea.length ? withIdea : todo
    if (pool.length) navigate(pool[Math.floor(Math.random() * pool.length)].letter)
  }

  return (
    <main className="home">
      <header className="home-header">
        <div>
          <h1>Alphabet Date</h1>
          <p className="muted">
            {settings.person1} &amp; {settings.person2}
          </p>
        </div>
        <button className="icon-btn" aria-label="Réglages" onClick={() => navigate('reglages')}>
          <GearIcon />
        </button>
      </header>

      <Progress done={done.length} total={dates.length} />

      <div className="toolbar">
        <div className="segmented" role="tablist">
          {(
            [
              ['all', `Toutes`],
              ['done', `Faites · ${done.length}`],
              ['todo', `À faire · ${todo.length}`],
            ] as const
          ).map(([key, label]) => (
            <button key={key} role="tab" aria-selected={filter === key} onClick={() => setFilter(key)}>
              {label}
            </button>
          ))}
        </div>
        {todo.length > 0 && (
          <button className="btn btn-small" onClick={pickRandom} title="Choisir le prochain date au hasard">
            🎲 Au hasard
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="empty">{filter === 'done' ? 'Pas encore de date réalisé… à vous de jouer !' : 'Tout est fait, bravo ! 🎉'}</p>
      ) : (
        <ul className="grid">
          {shown.map((d) => (
            <li key={d.letter}>
              <Tile entry={d} />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

function Tile({ entry }: { entry: DateEntry }) {
  const cover = entry.photos[0] ?? entry.photos[1]
  const state = entry.doneOn ? 'done' : entry.idea ? 'planned' : 'empty'
  return (
    <button className={`tile tile-${state}`} onClick={() => navigate(entry.letter)}>
      {cover && entry.doneOn && <img src={cover} alt="" loading="lazy" decoding="async" />}
      <span className="tile-letter">{entry.letter}</span>
      <span className="tile-label">{entry.idea || (state === 'empty' ? 'À imaginer' : '')}</span>
      {entry.doneOn && <span className="tile-check" aria-label="Fait">✓</span>}
    </button>
  )
}

function Progress({ done, total }: { done: number; total: number }) {
  const pct = total ? done / total : 0
  return (
    <section className="progress" aria-label={`${done} dates réalisés sur ${total}`}>
      <div className="progress-numbers">
        <strong>{done}</strong>
        <span>/ {total}</span>
      </div>
      <div className="progress-bar">
        <div style={{ width: `${pct * 100}%` }} />
      </div>
      <p className="muted small">
        {done === 0
          ? 'Tout commence par A…'
          : done === total
            ? 'Alphabet complet ! 💖'
            : `Encore ${total - done} lettre${total - done > 1 ? 's' : ''} à vivre`}
      </p>
    </section>
  )
}

function GearIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
