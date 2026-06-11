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
      // secure settes ikke hardt: lokal demo kjører på http://localhost
      secure: false,
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    },
  })
}
