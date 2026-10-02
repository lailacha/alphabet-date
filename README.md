# Alphabet Date 💖

Notre liste de dates de **A à Z**, avec la photo que chacune a prise de l'autre.
Appli mobile installable (PWA) : React 19 + API Go, hébergée sur Vercel.

- Grille A→Z : ce qui est fait (avec la photo en vignette), prévu, ou encore à imaginer
- **Plusieurs dates par lettre** : une lettre est « faite » dès qu'un de ses dates est réalisé
- Progression `x / 26`, filtres *Toutes / Faites / À faire*, et un 🎲 pour tirer le prochain date au hasard
- Page par date : idée, lieu, date de réalisation, souvenirs, et 2 photos (« Anaïs par Laïla » / « Laïla par Anaïs »)
- Photos compressées dans le navigateur (1600 px JPEG) puis stockées en base
- Protégé par un mot de passe partagé (cookie 1 an)

## Structure

```
api/index.go        point d'entrée serverless Vercel (toutes les routes /api/*)
pkg/server/         API Go : routes, auth, Postgres (tables créées automatiquement)
cmd/dev/            serveur local pour le dev
web/                front React 19 + Vite (PWA : manifest + service worker)
vercel.json         build du front + rewrite /api/* → fonction Go
```

### API

| Méthode | Route | |
|---|---|---|
| POST | `/api/login` `{password}` | ouvre la session |
| GET | `/api/entries` | tous les dates, triés par lettre |
| POST | `/api/entries` `{letter, idea, place, notes, doneOn}` | ajouter un date (`doneOn` = `AAAA-MM-JJ` ou `null`) |
| PUT / DELETE | `/api/entries/{id}` | modifier / supprimer un date (et ses photos) |
| PUT / DELETE | `/api/entries/{id}/photos/{1\|2}` | envoyer (corps = image brute, 4 Mo max) / supprimer une photo |
| GET | `/api/photos/{id}/{1\|2}` | l'image |
| GET / PUT | `/api/settings` `{person1, person2}` | vos prénoms |
| GET | `/api/health` | l'API et la base répondent-elles ? |

Les données de la première version (un seul date par lettre) sont reprises automatiquement au premier démarrage ; les anciennes tables `dates` / `photos` sont gardées en sauvegarde.

## Déployer sur Vercel

1. Importer le repo sur [vercel.com/new](https://vercel.com/new) (aucun preset de framework : `vercel.json` s'en charge).
2. **Storage → Create Database → Neon (Postgres)** et la lier au projet : ça ajoute `DATABASE_URL` automatiquement.
3. **Settings → Environment Variables** : ajouter `APP_PASSWORD` et `SESSION_SECRET`.
4. Redéployer. Les tables et les 26 lettres sont créées au premier appel.
5. Sur le téléphone : ouvrir l'URL → *Partager → Sur l'écran d'accueil* (iPhone) ou *⋮ → Installer l'application* (Android).

Le plan gratuit de Neon (0,5 Go) suffit largement : 52 photos compressées ≈ 20 Mo.

## Dev local

```bash
# Postgres local (ou une URL Neon)
export DATABASE_URL="postgres://postgres@localhost:5432/alphabet?sslmode=disable"
export APP_PASSWORD=secret        # optionnel en local

go run ./cmd/dev                  # API sur :8080
cd web && npm install && npm run dev   # front sur :5173 (proxy /api → :8080)
```

Pour tester sur le téléphone en local, ouvrir `http://<ip-du-pc>:5173` sur le même Wi-Fi.
