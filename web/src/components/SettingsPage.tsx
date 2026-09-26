import { useActionState } from 'react'
import { api, type Settings } from '../api'
import { goBack } from '../useHashRoute'

type Props = { settings: Settings; onSaved: () => Promise<void>; onLoggedOut: () => void }

export default function SettingsPage({ settings, onSaved, onLoggedOut }: Props) {
  const [state, save, saving] = useActionState(async (_: string | null, form: FormData) => {
    try {
      await api.saveSettings({
        person1: String(form.get('person1') ?? ''),
        person2: String(form.get('person2') ?? ''),
      })
      await onSaved()
      return 'Enregistré ✓'
    } catch (e) {
      return e instanceof Error ? e.message : 'Erreur'
    }
  }, null)

  return (
    <main className="detail">
      <header className="detail-header">
        <button className="icon-btn" aria-label="Retour" onClick={goBack}>
          ←
        </button>
        <h1 className="page-title">Réglages</h1>
        <span />
      </header>

      <form className="card form" action={save}>
        <p className="muted small">Vos prénoms, utilisés pour légender les photos (« Elle par Moi »).</p>
        <label>
          Prénom 1
          <input name="person1" defaultValue={settings.person1} required />
        </label>
        <label>
          Prénom 2
          <input name="person2" defaultValue={settings.person2} required />
        </label>
        {state && <p className="muted small">{state}</p>}
        <div className="form-actions">
          <button className="btn btn-primary" disabled={saving}>
            Enregistrer
          </button>
        </div>
      </form>

      <section className="card">
        <p className="muted small">
          Astuce : sur iPhone, ouvrez l'app dans Safari puis Partager → « Sur l'écran d'accueil ». Sur Android, menu ⋮ →
          « Installer l'application ».
        </p>
        <div className="form-actions">
          <button
            className="btn"
            onClick={async () => {
              await api.logout()
              onLoggedOut()
            }}
          >
            Se déconnecter
          </button>
        </div>
      </section>
    </main>
  )
}
