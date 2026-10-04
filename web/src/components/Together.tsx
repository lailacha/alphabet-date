import { useState } from 'react'
import { formatMonths, together } from '../together'
import { navigate } from '../useHashRoute'
import Burst from './Burst'

const CELEBRATED_KEY = 'ad-moisversaire'

export default function TogetherCard({ since }: { since: string }) {
  const t = together(since)
  // Confetti once per mois-versaire and per phone.
  const [burst] = useState(() => {
    if (!t?.isMonthiversary) return false
    const key = `${CELEBRATED_KEY}-${since}-${t.months}`
    try {
      if (localStorage.getItem(key)) return false
      localStorage.setItem(key, '1')
    } catch {
      /* private mode */
    }
    return true
  })

  if (!t) {
    return (
      <button className="together together-empty" onClick={() => navigate('reglages')}>
        💕 Ajoutez la date de début de votre histoire
      </button>
    )
  }

  return (
    <section className={`together ${t.isMonthiversary ? 'together-party' : ''}`}>
      {burst && <Burst count={36} delay={0.3} />}
      {t.isMonthiversary ? (
        <>
          <p className="together-big">Joyeux {formatMonths(t.months)} 🎉</p>
          <p className="muted small">{t.days.toLocaleString('fr-FR')} jours ensemble aujourd'hui</p>
        </>
      ) : (
        <>
          <p className="together-big">
            <span className="together-heart">❤</span> {t.days.toLocaleString('fr-FR')} jours ensemble
          </p>
          <p className="muted small">soit {formatMonths(t.months)} d'amour</p>
        </>
      )}
    </section>
  )
}
