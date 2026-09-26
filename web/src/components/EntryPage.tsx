import { useActionState, useEffect, useRef, useState } from 'react'
import { api, type Entry, type EntryInput, type Settings } from '../api'
import { compressImage } from '../image'
import { formatDate, today } from '../letters'
import { goBack, navigate } from '../useHashRoute'

type Props = {
  letter: string
  /** null = creating a new date for this letter */
  entry: Entry | null
  settings: Settings
  onChanged: () => Promise<void>
}

export default function EntryPage({ letter, entry, settings, onChanged }: Props) {
  const [editing, setEditing] = useState(!entry)
  const [viewer, setViewer] = useState<string | null>(null)

  const [error, save, saving] = useActionState(async (_: string | null, form: FormData) => {
    const input: EntryInput = {
      idea: String(form.get('idea') ?? ''),
      place: String(form.get('place') ?? ''),
      notes: String(form.get('notes') ?? ''),
      doneOn: String(form.get('doneOn') ?? '') || null,
    }
    try {
      if (entry) {
        await api.updateEntry(entry.id, input)
        await onChanged()
        setEditing(false)
      } else {
        const { id } = await api.createEntry(letter, input)
        await onChanged()
        // Stay on the new date so photos can be added right away.
        navigate(`${letter}/${id}`, { replace: true })
      }
      return null
    } catch (e) {
      return e instanceof Error ? e.message : 'Erreur'
    }
  }, null)

  const markDone = async (done: boolean) => {
    if (!entry) return
    await api.updateEntry(entry.id, { ...entry, doneOn: done ? today() : null })
    await onChanged()
  }

  const remove = async () => {
    if (!entry || !confirm(`Supprimer « ${entry.idea} » et ses photos ?`)) return
    await api.deleteEntry(entry.id)
    goBack(letter)
    await onChanged()
  }

  return (
    <main className="detail">
      <header className="detail-header">
        <button className="icon-btn" aria-label="Retour" onClick={() => goBack(letter)}>
          ←
        </button>
        <span className="detail-letter">{letter}</span>
        {entry ? (
          <span className={`badge ${entry.doneOn ? 'badge-done' : ''}`}>{entry.doneOn ? 'Fait ✓' : 'À faire'}</span>
        ) : (
          <span className="badge">Nouveau</span>
        )}
      </header>

      {editing ? (
        <form className="card form" action={save}>
          <label>
            Le date
            <input name="idea" defaultValue={entry?.idea} placeholder={`Une idée en ${letter}…`} autoFocus required />
          </label>
          <label>
            Lieu
            <input name="place" defaultValue={entry?.place} placeholder="Où ?" />
          </label>
          <label>
            Réalisé le
            <input name="doneOn" type="date" defaultValue={entry?.doneOn ?? ''} />
          </label>
          <label>
            Souvenirs / notes
            <textarea name="notes" defaultValue={entry?.notes} rows={4} placeholder="Ce qu'on retient…" />
          </label>
          {error && <p className="error">{error}</p>}
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => (entry ? setEditing(false) : goBack(letter))}>
              Annuler
            </button>
            <button className="btn btn-primary" disabled={saving}>
              {saving ? 'Enregistrement…' : entry ? 'Enregistrer' : 'Ajouter'}
            </button>
          </div>
        </form>
      ) : (
        entry && (
          <section className="card info">
            <h1>{entry.idea}</h1>
            {entry.place && <p className="info-line">📍 {entry.place}</p>}
            {entry.doneOn && <p className="info-line">📅 {formatDate(entry.doneOn)}</p>}
            {entry.notes && <p className="notes">{entry.notes}</p>}
            <div className="form-actions">
              <button className="btn" onClick={() => setEditing(true)}>
                Modifier
              </button>
              {entry.doneOn ? (
                <button className="btn" onClick={() => markDone(false)}>
                  Remettre à faire
                </button>
              ) : (
                <button className="btn btn-primary" onClick={() => markDone(true)}>
                  C'est fait aujourd'hui !
                </button>
              )}
            </div>
          </section>
        )
      )}

      {entry && (
        <>
          <section className="photos">
            <h2>Nos photos</h2>
            <div className="photo-pair">
              <PhotoSlot entry={entry} slot={1} label={`${settings.person2} par ${settings.person1}`} onChanged={onChanged} onOpen={setViewer} />
              <PhotoSlot entry={entry} slot={2} label={`${settings.person1} par ${settings.person2}`} onChanged={onChanged} onOpen={setViewer} />
            </div>
          </section>

          <div className="form-actions danger-zone">
            <button className="link danger" onClick={remove}>
              Supprimer ce date
            </button>
          </div>
        </>
      )}

      {viewer && (
        <div className="viewer" onClick={() => setViewer(null)} role="dialog" aria-label="Photo">
          <img src={viewer} alt="" />
        </div>
      )}
    </main>
  )
}

type SlotProps = {
  entry: Entry
  slot: 1 | 2
  label: string
  onChanged: () => Promise<void>
  onOpen: (url: string) => void
}

function PhotoSlot({ entry, slot, label, onChanged, onOpen }: SlotProps) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const url = entry.photos[slot - 1]

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])

  const upload = async (file: File) => {
    setBusy(true)
    setError(null)
    try {
      const blob = await compressImage(file)
      setPreview(URL.createObjectURL(blob))
      await api.uploadPhoto(entry.id, slot, blob)
      await onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Envoi impossible')
    } finally {
      setBusy(false)
      setPreview(null)
    }
  }

  const remove = async () => {
    if (!confirm('Supprimer cette photo ?')) return
    setBusy(true)
    try {
      await api.deletePhoto(entry.id, slot)
      await onChanged()
    } finally {
      setBusy(false)
    }
  }

  const src = preview ?? url
  return (
    <figure className={`photo-slot ${busy ? 'busy' : ''}`}>
      {src ? (
        <button className="photo" onClick={() => url && onOpen(url)}>
          <img src={src} alt={label} />
        </button>
      ) : (
        <button className="photo photo-empty" onClick={() => input.current?.click()} disabled={busy}>
          <span className="plus">＋</span>
          <span>Ajouter</span>
        </button>
      )}
      <figcaption>{label}</figcaption>
      {url && !busy && (
        <div className="photo-actions">
          <button className="link" onClick={() => input.current?.click()}>
            Changer
          </button>
          <button className="link danger" onClick={remove}>
            Supprimer
          </button>
        </div>
      )}
      {error && <p className="error small">{error}</p>}
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) upload(f)
        }}
      />
    </figure>
  )
}
