import { createFileRoute } from '@tanstack/react-router'
import { getAuth } from '../../../server/auth-instance'

/**
 * Normaliserer `email` i JSON-kroppen til små bokstaver FØR better-auth ser den.
 * SQLite er case-sensitiv på både oppslag og UNIQUE, så uten dette kunne «A@x»
 * (f.eks. mobiltastatur med stor forbokstav) bomme på en eksisterende «a@x»
 * og forsøke å lage en duplikatkonto. Gjør hele auth-flyten case-insensitiv.
 */
async function normalizeEmail(request: Request): Promise<Request> {
  const ct = request.headers.get('content-type') ?? ''
  if (request.method !== 'POST' || !ct.includes('application/json')) return request
  try {
    const body = (await request.clone().json()) as Record<string, unknown>
    if (body && typeof body.email === 'string') {
      body.email = body.email.trim().toLowerCase()
      const headers = new Headers(request.headers)
      headers.delete('content-length') // settes på nytt fra ny kropp
      return new Request(request.url, { method: 'POST', headers, body: JSON.stringify(body) })
    }
  } catch {
    // ikke JSON / ingen kropp — send videre uendret
  }
  return request
}

// Catch-all for better-auth: serverer /api/auth/* (innlogging, magisk lenke,
// passord-reset, sesjon, callbacks).
export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => getAuth().handler(request),
      POST: async ({ request }) => getAuth().handler(await normalizeEmail(request)),
    },
  },
})
