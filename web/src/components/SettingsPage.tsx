import { useActionState } from 'react'
import { api, type Settings } from '../api'
import { goBack } from '../useHashRoute'

type Props = {
  settings: Settings
  onSaved: () => Promise<void>
  onReplaySurprise: () => void
  onLoggedOut: () => void
}

export default function SettingsPage({ settings, onSaved, onReplaySurprise, onLoggedOut }: Props) {
  const [state, save, saving] = useActionState(async (_: string | null, form: FormData) => {
    try {
      await api.saveSettings({
        person1: String(form.get('person1') ?? ''),
        person2: String(form.get('person2') ?? ''),
        since: String(form.get('since') ?? ''),
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
        <button className="icon-btn" aria-label="Retour" onClick={() => goBack()}>
          ←
        </button>
        <h1 className="page-title">Réglages</h1>
        <span />
      </header>

      <form className="card form" action={save}>
        <p className="muted small">Vos prénoms, affichés en haut de l'accueil.</p>
        <label>
          Prénom 1
          <input name="person1" defaultValue={settings.person1} required />
        </label>
        <label>
          Prénom 2
          <input name="person2" defaultValue={settings.person2} required />
        </label>
        <label>
          Ensemble depuis
          <input name="since" type="date" defaultValue={settings.since} />
        </label>
        {state && <p className="muted small">{state}</p>}
        <div className="form-actions">
          <button className="btn btn-primary" disabled={saving}>
            Enregistrer
          </button>
        </div>
      </form>

      <section className="card">
        <div className="form-actions">
          <button className="btn" onClick={onReplaySurprise}>
            🎁 Revoir la surprise
          </button>
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
