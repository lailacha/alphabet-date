export type DateEntry = {
  letter: string
  idea: string
  place: string
  notes: string
  doneOn: string | null
  photos: [string | null, string | null]
  updatedAt: string
}

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
  dates: () => request<DateEntry[]>('/dates'),
  updateDate: (letter: string, d: Pick<DateEntry, 'idea' | 'place' | 'notes' | 'doneOn'>) =>
    request<void>(`/dates/${letter}`, json('PUT', d)),
  uploadPhoto: (letter: string, slot: 1 | 2, blob: Blob) =>
    request<void>(`/dates/${letter}/photos/${slot}`, {
      method: 'PUT',
      headers: { 'Content-Type': blob.type || 'application/octet-stream' },
      body: blob,
    }),
  deletePhoto: (letter: string, slot: 1 | 2) =>
    request<void>(`/dates/${letter}/photos/${slot}`, { method: 'DELETE' }),
  settings: () => request<Settings>('/settings'),
  saveSettings: (s: Settings) => request<void>('/settings', json('PUT', s)),
}
