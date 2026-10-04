import { useMemo, useState, type CSSProperties } from 'react'
import { surprise } from '../surprise'

type Stage = 'closed' | 'opening' | 'open'

const BURST = ['❤', '💗', '💖', '✨', '❤', '💕']
const CONFETTI = ['#e0607e', '#f29a8e', '#f2c46d', '#f6e9e4', '#c084fc', '#6cc9a1']

export default function Surprise({ onDone }: { onDone: () => void }) {
  const [stage, setStage] = useState<Stage>('closed')

  // Random trajectories, computed once so they don't jump on re-render.
  const particles = useMemo(
    () =>
      Array.from({ length: 46 }, (_, i) => {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4
        const dist = 120 + Math.random() * 220
        return {
          id: i,
          heart: i % 3 === 0,
          glyph: BURST[i % BURST.length],
          color: CONFETTI[i % CONFETTI.length],
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          r: (Math.random() - 0.5) * 720,
          delay: Math.random() * 0.15,
          size: 0.8 + Math.random() * 0.9,
        }
      }),
    [],
  )
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
          <p className="gift-to">Pour toi, {surprise.to}</p>
          <span className="gift">
            <span className="gift-lid" />
            <span className="gift-body" />
            <span className="gift-bow" />
          </span>
          <p className="gift-hint">{stage === 'closed' ? 'Touche pour ouvrir' : ' '}</p>
        </button>
      )}

      {stage !== 'closed' && (
        <div className="burst" aria-hidden>
          {particles.map((p) => (
            <span
              key={p.id}
              className={p.heart ? 'burst-heart' : 'burst-confetti'}
              style={
                {
                  '--x': `${p.x}px`,
                  '--y': `${p.y}px`,
                  '--r': `${p.r}deg`,
                  '--s': p.size,
                  animationDelay: `${p.delay}s`,
                  background: p.heart ? undefined : p.color,
                  color: p.heart ? p.color : undefined,
                } as CSSProperties
              }
            >
              {p.heart ? p.glyph : ''}
            </span>
          ))}
        </div>
      )}

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
          <p className="love-from">— {surprise.from}</p>
          <button className="btn btn-primary" onClick={onDone}>
            {surprise.button}
          </button>
        </article>
      )}
    </div>
  )
}
