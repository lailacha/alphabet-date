import { useMemo, type CSSProperties } from 'react'

const GLYPHS = ['❤', '💗', '💖', '✨', '❤', '💕']
const COLORS = ['#e0607e', '#f29a8e', '#f2c46d', '#f6e9e4', '#c084fc', '#6cc9a1']

/** Hearts and confetti bursting from the centre of its positioned parent. */
export default function Burst({ count = 46, delay = 0 }: { count?: number; delay?: number }) {
  // Random trajectories, computed once so they don't jump on re-render.
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4
        const dist = 120 + Math.random() * 220
        return {
          id: i,
          heart: i % 3 === 0,
          glyph: GLYPHS[i % GLYPHS.length],
          color: COLORS[i % COLORS.length],
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          r: (Math.random() - 0.5) * 720,
          delay: delay + Math.random() * 0.15,
          size: 0.8 + Math.random() * 0.9,
        }
      }),
    [count, delay],
  )
  return (
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
  )
}
