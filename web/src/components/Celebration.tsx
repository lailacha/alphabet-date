import { useEffect } from 'react'
import Burst from './Burst'

type Props = { letter: string; done: number; total: number; onClose: () => void }

/** Shown when a letter gets its first done date. */
export default function Celebration({ letter, done, total, onClose }: Props) {
  useEffect(() => {
    navigator.vibrate?.([30, 40, 60])
    const t = setTimeout(onClose, 4500)
    return () => clearTimeout(t)
  }, [onClose])

  const finished = done === total
  return (
    <div className="celebration" onClick={onClose} role="dialog" aria-label={`Lettre ${letter} faite`}>
      <Burst count={finished ? 80 : 50} />
      <div className="celebration-card">
        <span className="celebration-letter">{letter}</span>
        <p className="celebration-title">{finished ? 'Alphabet complet !' : `Lettre ${letter} faite !`}</p>
        <p className="muted">
          {finished ? `Les ${total} lettres, ensemble 💖` : `${done} / ${total} · encore ${total - done} à vivre`}
        </p>
      </div>
    </div>
  )
}
