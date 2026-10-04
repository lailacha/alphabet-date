import { useActionState } from 'react'
import { api } from '../api'

export default function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [error, submit, pending] = useActionState(async (_: string | null, form: FormData) => {
    try {
      await api.login(String(form.get('password') ?? ''))
      onLoggedIn()
      return null
    } catch (e) {
      return e instanceof Error ? e.message : 'Erreur'
    }
  }, null)

  return (
    <main className="login">
      <div className="login-card">
        <div className="login-logo">A–Z</div>
        <h1>Alphabet Date</h1>
        <p className="muted">Nos rendez-vous, de A à Z.</p>
        <form action={submit}>
          <input
            name="password"
            type="password"
            placeholder="Mot de passe"
            autoComplete="current-password"
            autoFocus
            required
          />
          <p className="login-hint">💡 Indice : ton plat préféré</p>
          <button className="btn btn-primary" disabled={pending}>
            {pending ? '…' : 'Entrer'}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
      </div>
    </main>
  )
}
