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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? 'GET'
  let res: Response
  try {
    res = await fetch(`/api${path}`, { credentials: 'same-origin', ...init })
  } catch (e) {
    // Mobile networks drop requests now and then: retry reads once.
    if (method === 'GET') {
      await sleep(800)
      try {
        res = await fetch(`/api${path}`, { credentials: 'same-origin', ...init })
      } catch (e2) {
        throw networkError(method, path, e2)
      }
    } else {
      throw networkError(method, path, e)
    }
  }
  if (!res.ok) {
    let msg = `Erreur ${res.status} (${method} /api${path})`
    const text = await res.text().catch(() => '')
    try {
      const body = JSON.parse(text)
      msg = body.error ?? msg
      if (body.detail) msg += ` — ${body.detail}`
    } catch {
      // Not our JSON: an error page from Vercel (timeout, crash, too large…).
      const code = res.headers.get('x-vercel-error')
      if (code) msg += ` — ${code}`
      else if (text) msg += ` — ${text.slice(0, 120)}`
    }
    throw new ApiError(res.status, msg)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

function networkError(method: string, path: string, e: unknown) {
  const why = e instanceof Error ? e.message : String(e)
  return new ApiError(0, `Connexion au serveur impossible (${method} /api${path}) — ${why}`)
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
