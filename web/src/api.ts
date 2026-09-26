/** One date. A letter can have several. */
export type Entry = {
  id: number
  letter: string
  idea: string
  place: string
  notes: string
  doneOn: string | null
  photos: [string | null, string | null]
  createdAt: string
}

export type EntryInput = Pick<Entry, 'idea' | 'place' | 'notes' | 'doneOn'>

export type Settings = { person1: string; person2: string }

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, { credentials: 'same-origin', ...init })
  if (!res.ok) {
    let msg = `Erreur ${res.status}`
    try {
      const body = await res.json()
      msg = body.error ?? msg
      if (body.detail) msg += ` — ${body.detail}`
    } catch {
      /* not JSON */
    }
    throw new ApiError(res.status, msg)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export const api = {
  me: () => request<{ authenticated: boolean; passwordRequired: boolean }>('/me'),
  login: (password: string) => request<void>('/login', json('POST', { password })),
  logout: () => request<void>('/logout', { method: 'POST' }),
  entries: () => request<Entry[]>('/entries'),
  createEntry: (letter: string, e: EntryInput) =>
    request<{ id: number }>('/entries', json('POST', { letter, ...e })),
  updateEntry: (id: number, e: EntryInput) => request<void>(`/entries/${id}`, json('PUT', e)),
  deleteEntry: (id: number) => request<void>(`/entries/${id}`, { method: 'DELETE' }),
  uploadPhoto: (id: number, slot: 1 | 2, blob: Blob) =>
    request<void>(`/entries/${id}/photos/${slot}`, {
      method: 'PUT',
      headers: { 'Content-Type': blob.type || 'application/octet-stream' },
      body: blob,
    }),
  deletePhoto: (id: number, slot: 1 | 2) => request<void>(`/entries/${id}/photos/${slot}`, { method: 'DELETE' }),
  settings: () => request<Settings>('/settings'),
  saveSettings: (s: Settings) => request<void>('/settings', json('PUT', s)),
}
