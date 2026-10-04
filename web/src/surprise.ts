// La surprise des 6 mois : le texte est ici, change-le librement.
// Chaque ligne de `message` devient un paragraphe.

export const surprise = {
  to: 'Anaïs',
  from: 'Laïla',
  title: 'Joyeux 6 mois',
  message: [
    '6 mois déjà. 6 mois de crêpes, de couchers de soleil, de fous rires et de moments à nous.',
    "Il nous reste encore plein de lettres à vivre ensemble, alors je t'ai fait une petite maison pour toutes les garder : nos idées, nos souvenirs, et chaque photo que l'on prend l'une de l'autre.",
    'Joyeux 6 mois mon cœur ❤️',
  ],
  button: 'Ouvrir notre alphabet',
}

const SEEN_KEY = 'ad-surprise-6-mois'

export function surpriseSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

export function markSurpriseSeen(seen = true) {
  try {
    if (seen) localStorage.setItem(SEEN_KEY, '1')
    else localStorage.removeItem(SEEN_KEY)
  } catch {
    /* private mode: it will show again next time, that's fine */
  }
}
