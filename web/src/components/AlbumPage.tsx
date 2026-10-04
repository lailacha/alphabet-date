import { useEffect, useRef, useState } from 'react'
import type { Entry } from '../api'
import { formatDate } from '../letters'
import { goBack, navigate } from '../useHashRoute'

type Photo = { url: string; entry: Entry }

/** Every photo, in the order you lived them (dated ones first, then A→Z). */
function collect(entries: Entry[]): Photo[] {
  const withPhotos = entries.filter((e) => e.photos.some(Boolean))
  withPhotos.sort((a, b) => {
    if (a.doneOn && b.doneOn) return a.doneOn.localeCompare(b.doneOn)
    if (a.doneOn) return -1
    if (b.doneOn) return 1
    return a.letter.localeCompare(b.letter) || a.id - b.id
  })
  return withPhotos.flatMap((e) => e.photos.filter((u): u is string => !!u).map((url) => ({ url, entry: e })))
}

export default function AlbumPage({ entries }: { entries: Entry[] }) {
  const photos = collect(entries)
  const [index, setIndex] = useState<number | null>(null)

  return (
    <main className="detail">
      <header className="detail-header">
        <button className="icon-btn" aria-label="Retour" onClick={() => goBack()}>
          ←
        </button>
        <h1 className="page-title">Nos souvenirs</h1>
        <span />
      </header>

      {photos.length === 0 ? (
        <p className="empty">
          Pas encore de photo… Ajoutez-en une sur un date réalisé et elle apparaîtra ici 📷
        </p>
      ) : (
        <>
          <button className="btn btn-primary btn-block album-play" onClick={() => setIndex(0)}>
            ▶ Diaporama · {photos.length} photo{photos.length > 1 ? 's' : ''}
          </button>
          <ul className="album">
            {photos.map((p, i) => (
              <li key={p.url}>
                <button className="album-item" onClick={() => setIndex(i)}>
                  <img src={p.url} alt={p.entry.idea} loading="lazy" decoding="async" />
                  <span className="album-caption">
                    <b>{p.entry.letter}</b> {p.entry.idea}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {index !== null && <Slideshow photos={photos} start={index} onClose={() => setIndex(null)} />}
    </main>
  )
}

function Slideshow({ photos, start, onClose }: { photos: Photo[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start)
  const [playing, setPlaying] = useState(start === 0)
  const touchX = useRef<number | null>(null)
  const n = photos.length
  const go = (d: number) => setI((x) => (x + d + n) % n)

  useEffect(() => {
    if (!playing) return
    const t = setInterval(() => setI((x) => (x + 1) % n), 3500)
    return () => clearInterval(t)
  }, [playing, n])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const p = photos[i]
  return (
    <div
      className="slideshow"
      role="dialog"
      aria-label="Diaporama"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return
        const dx = e.changedTouches[0].clientX - touchX.current
        touchX.current = null
        if (Math.abs(dx) > 40) {
          setPlaying(false)
          go(dx < 0 ? 1 : -1)
        }
      }}
    >
      <img key={p.url} className="slide" src={p.url} alt={p.entry.idea} />
      <div className="slide-caption">
        <button className="slide-title" onClick={() => navigate(`${p.entry.letter}/${p.entry.id}`)}>
          <b>{p.entry.letter}</b> · {p.entry.idea}
        </button>
        <span>{p.entry.doneOn ? formatDate(p.entry.doneOn) : `${i + 1} / ${n}`}</span>
      </div>
      <button className="slide-nav slide-prev" aria-label="Précédente" onClick={() => (setPlaying(false), go(-1))}>
        ‹
      </button>
      <button className="slide-nav slide-next" aria-label="Suivante" onClick={() => (setPlaying(false), go(1))}>
        ›
      </button>
      <div className="slide-bar">
        <button className="icon-btn" aria-label={playing ? 'Pause' : 'Lecture'} onClick={() => setPlaying(!playing)}>
          {playing ? '❚❚' : '▶'}
        </button>
        <button className="icon-btn" aria-label="Fermer" onClick={onClose}>
          ✕
        </button>
      </div>
    </div>
  )
}
