import type { Entry } from '../api'
import { formatDate, LETTERS } from '../letters'
import { goBack, navigate } from '../useHashRoute'
import SplitPhoto from './SplitPhoto'

export default function LetterPage({ letter, entries }: { letter: string; entries: Entry[] }) {
  const mine = entries.filter((e) => e.letter === letter)
  const doneCount = mine.filter((e) => e.done).length
  const i = LETTERS.indexOf(letter)

  return (
    <main className="detail">
      <header className="detail-header">
        <button className="icon-btn" aria-label="Retour" onClick={() => goBack()}>
          ←
        </button>
        <nav className="letter-nav">
          <button
            className="icon-btn"
            aria-label="Lettre précédente"
            disabled={i === 0}
            onClick={() => navigate(LETTERS[i - 1], { replace: true })}
          >
            ‹
          </button>
          <span className="detail-letter">{letter}</span>
          <button
            className="icon-btn"
            aria-label="Lettre suivante"
            disabled={i === LETTERS.length - 1}
            onClick={() => navigate(LETTERS[i + 1], { replace: true })}
          >
            ›
          </button>
        </nav>
        <span className={`badge ${doneCount ? 'badge-done' : ''}`}>{doneCount ? 'Fait ✓' : 'À faire'}</span>
      </header>

      {mine.length === 0 ? (
        <p className="empty">Aucune idée en {letter} pour l'instant.</p>
      ) : (
        <ul className="entry-list">
          {mine.map((e) => {
            const cover = e.photos[0] ?? e.photos[1]
            return (
              <li key={e.id}>
                <button className={`entry-card ${e.done ? 'is-done' : ''}`} onClick={() => navigate(`${letter}/${e.id}`)}>
                  <span className="entry-thumb">
                    {cover ? <SplitPhoto src={cover} /> : <span>{e.done ? '✓' : letter}</span>}
                  </span>
                  <span className="entry-text">
                    <strong>{e.idea || 'Sans titre'}</strong>
                    <span className="muted small">
                      {e.done ? (e.doneOn ? `✓ ${formatDate(e.doneOn)}` : '✓ Fait') : 'À faire'}
                      {e.place && ` · ${e.place}`}
                    </span>
                  </span>
                  <span className="chevron" aria-hidden>
                    ›
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <button className="btn btn-primary btn-block" onClick={() => navigate(`${letter}/nouveau`)}>
        ＋ Ajouter un date en {letter}
      </button>
    </main>
  )
}
