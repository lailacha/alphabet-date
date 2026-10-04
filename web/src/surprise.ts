// La surprise des 6 mois : le texte est ici, change-le librement.
// Chaque ligne de `message` devient un paragraphe.

export const surprise = {
  /** First line of the card: « Poupée, » */
  to: 'Poupée',
  /** Shown on the gift box: « Pour toi, poupée ». */
  nickname: 'poupée',
  from: 'Laïla (Laïlouch)',
  title: 'Joyeux 6 mois',
  message: [
    "6 mois déjà. 6 mois de crêpes bretonnes, de couchers de soleil, de péripéties et d'amour.",
    "Il nous reste encore plein de lettres à vivre ensemble, alors je t'ai fait une petite appli pour toutes les garder: nos idées, nos souvenirs, et chaque photo que l'on prend!",
    "Merci d'être celle que tu es ❤️",
    "Joyeux 6 mois mon cœur (même si je sais que t'aimes pas) ❤️",
    "Je t'aime",
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
