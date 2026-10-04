// "Ensemble depuis…" maths, in local time.

const parse = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export type Together = {
  days: number
  /** Whole months since the start. */
  months: number
  /** Today is a "mois-versaire" (same day of the month as the start). */
  isMonthiversary: boolean
}

export function together(since: string, now = new Date()): Together | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) return null
  const start = parse(since)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (today < start) return null

  const days = Math.round((today.getTime() - start.getTime()) / 86_400_000)
  let months = (today.getFullYear() - start.getFullYear()) * 12 + today.getMonth() - start.getMonth()
  if (today.getDate() < start.getDate()) months--

  // Started on the 31st: celebrate on the last day of shorter months.
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const anniversaryDay = Math.min(start.getDate(), lastDay)
  const isMonthiversary = months > 0 && today.getDate() === anniversaryDay

  return { days, months, isMonthiversary }
}

/** "6 mois", "1 an et 2 mois", "2 ans". */
export function formatMonths(months: number): string {
  const y = Math.floor(months / 12)
  const m = months % 12
  const ys = y ? `${y} an${y > 1 ? 's' : ''}` : ''
  const ms = m ? `${m} mois` : ''
  return [ys, ms].filter(Boolean).join(' et ') || 'moins d’un mois'
}
