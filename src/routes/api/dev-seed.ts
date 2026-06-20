import { createFileRoute } from '@tanstack/react-router'
import { seedBaseConfig, seedDemoData } from '../../server/seed'

/**
 * KUN for lokal utvikling (import.meta.env.DEV). Seeder besetning, roller og
 * demoinnhold + invitasjoner for demomedlemmene, slik at man kan logge inn via
 * magisk lenke i dev. I produksjonsbygget returnerer ruten 404.
 */
export const Route = createFileRoute('/api/dev-seed')({
  server: {
    handlers: {
      POST: async () => {
        if (!import.meta.env.DEV) return new Response('Not found', { status: 404 })
        await seedBaseConfig()
        const res = await seedDemoData()
        return Response.json(res)
      },
    },
  },
})
