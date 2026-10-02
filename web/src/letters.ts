import type { Entry } from './api'

export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

export type LetterSummary = {
  letter: string
  entries: Entry[]
  done: Entry[]
  /** A letter counts as done as soon as one of its dates is done. */
  isDone: boolean
  /** The date shown on the tile: the first done one, else the first. */
  lead: Entry | null
  cover: string | null
}

export function summarize(entries: Entry[]): LetterSummary[] {
  return LETTERS.map((letter) => {
    const mine = entries.filter((e) => e.letter === letter)
    const done = mine.filter((e) => e.done)
    // The API lists done dates first.
    const lead = mine[0] ?? null
    const cover = [lead, ...done].flatMap((e) => e?.photos ?? []).find((p) => p) ?? null
    return { letter, entries: mine, done, isDone: done.length > 0, lead, cover }
  })
}

const MONTH_FMT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }
export const formatDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', MONTH_FMT)

export const today = () => new Date().toLocaleDateString('sv-SE') // YYYY-MM-DD, local time
