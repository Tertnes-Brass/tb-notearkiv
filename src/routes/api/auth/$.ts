import { createFileRoute } from '@tanstack/react-router'
import { getAuth } from '../../../server/auth-instance'

// Catch-all for better-auth: serverer /api/auth/* (innlogging, magisk lenke,
// passord-reset, sesjon, callbacks). Speiler stilen i src/routes/api/upload.ts.
export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => getAuth().handler(request),
      POST: ({ request }) => getAuth().handler(request),
    },
  },
})
