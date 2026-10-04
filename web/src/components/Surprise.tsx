import { useMemo, useState } from 'react'
import Burst from './Burst'
import { surprise } from '../surprise'

type Stage = 'closed' | 'opening' | 'open'

export default function Surprise({ onDone }: { onDone: () => void }) {
  const [stage, setStage] = useState<Stage>('closed')

  const floaters = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 8,
        duration: 7 + Math.random() * 6,
        size: 0.7 + Math.random() * 0.9,
      })),
    [],
  )

  const open = () => {
    if (stage !== 'closed') return
    navigator.vibrate?.([30, 40, 60])
    setStage('opening')
    setTimeout(() => setStage('open'), 900)
  }

  return (
    <div className={`surprise stage-${stage}`} role="dialog" aria-label="Une surprise pour toi">
      <div className="surprise-floaters" aria-hidden>
        {floaters.map((f) => (
          <span
            key={f.id}
            style={{
              left: `${f.left}%`,
              animationDelay: `${f.delay}s`,
              animationDuration: `${f.duration}s`,
              fontSize: `${f.size}rem`,
            }}
          >
            ❤
          </span>
        ))}
      </div>

      {stage !== 'open' && (
        <button className="gift-wrap" onClick={open} aria-label="Ouvrir le cadeau">
          <p className="gift-to">Pour toi, {surprise.nickname}</p>
          <span className="gift">
            <span className="gift-lid" />
            <span className="gift-body" />
            <span className="gift-bow" />
          </span>
          <p className="gift-hint">{stage === 'closed' ? 'Touche pour ouvrir' : ' '}</p>
        </button>
      )}

      {stage !== 'closed' && <Burst delay={0.4} />}

      {stage === 'open' && (
        <article className="love-card">
          <p className="love-kicker">6 mois</p>
          <h1>{surprise.title}</h1>
          <p className="love-to">{surprise.to},</p>
          {surprise.message.map((line, i) => (
            <p key={i} style={{ animationDelay: `${0.35 + i * 0.25}s` }}>
              {line}
            </p>
          ))}
          <p className="love-from" style={{ animationDelay: `${0.35 + surprise.message.length * 0.25}s` }}>
            — {surprise.from}
          </p>
          <button
            className="btn btn-primary"
            onClick={onDone}
            style={{ animationDelay: `${0.65 + surprise.message.length * 0.25}s` }}
          >
            {surprise.button}
          </button>
        </article>
      )}
    </div>
  )
}
