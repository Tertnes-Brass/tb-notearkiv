import { useSession } from '@tanstack/react-start/server'
import { env } from 'cloudflare:workers'

export type SessionData = {
  userId?: string
}

export function useAppSession() {
  return useSession<SessionData>({
    name: 'tb_session',
    password: env.SESSION_SECRET,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      // https i produksjon; lokal dev kjører på http://localhost
      secure: import.meta.env.PROD,
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    },
  })
}
