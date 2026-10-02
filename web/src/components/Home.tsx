import { useState } from 'react'
import type { Entry, Settings } from '../api'
import { summarize, type LetterSummary } from '../letters'
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

export default function Home({ entries, settings }: { entries: Entry[]; settings: Settings }) {
  const [filter, setFilterState] = useState<Filter>(loadFilter)
  const setFilter = (f: Filter) => {
    setFilterState(f)
    try {
      localStorage.setItem(FILTER_KEY, f)
    } catch {
      /* private mode */
    }
  }

  const letters = summarize(entries)
  const done = letters.filter((l) => l.isDone)
  const todo = letters.filter((l) => !l.isDone)
  const shown = filter === 'done' ? done : filter === 'todo' ? todo : letters
  const datesDone = entries.filter((e) => e.done).length

  // Prefer a planned date from a letter not done yet, then any planned date,
  // then just an empty letter to fill in.
  const pickRandom = () => {
    const planned = entries.filter((e) => !e.done)
    const fresh = planned.filter((e) => todo.some((l) => l.letter === e.letter))
    const pool = fresh.length ? fresh : planned
    if (pool.length) {
      const e = pool[Math.floor(Math.random() * pool.length)]
      navigate(`${e.letter}/${e.id}`)
    } else if (todo.length) {
      navigate(todo[Math.floor(Math.random() * todo.length)].letter)
    }
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

      <Progress done={done.length} total={letters.length} datesDone={datesDone} />

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
        {(todo.length > 0 || entries.some((e) => !e.done)) && (
          <button className="btn btn-small" onClick={pickRandom} title="Choisir le prochain date au hasard">
            🎲 Au hasard
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="empty">{filter === 'done' ? 'Pas encore de date réalisé… à vous de jouer !' : 'Tout est fait, bravo ! 🎉'}</p>
      ) : (
        <ul className="grid">
          {shown.map((l) => (
            <li key={l.letter}>
              <Tile summary={l} />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

function Tile({ summary }: { summary: LetterSummary }) {
  const { letter, entries, done, isDone, lead, cover } = summary
  const state = isDone ? 'done' : lead ? 'planned' : 'empty'
  const label = !lead
    ? 'À imaginer'
    : entries.length === 1
      ? lead.idea
      : isDone
        ? `${lead.idea} +${entries.length - 1}`
        : `${entries.length} idées`
  return (
    <button className={`tile tile-${state}`} onClick={() => navigate(letter)}>
      {cover && <img src={cover} alt="" loading="lazy" decoding="async" />}
      <span className="tile-letter">{letter}</span>
      <span className="tile-label">{label}</span>
      {isDone && (
        <span className="tile-check" aria-label={`${done.length} fait${done.length > 1 ? 's' : ''}`}>
          {done.length > 1 ? done.length : '✓'}
        </span>
      )}
    </button>
  )
}

function Progress({ done, total, datesDone }: { done: number; total: number; datesDone: number }) {
  const pct = total ? done / total : 0
  return (
    <section className="progress" aria-label={`${done} lettres faites sur ${total}`}>
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
        {datesDone > done && ` · ${datesDone} dates au total`}
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
