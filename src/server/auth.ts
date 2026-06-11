import { createServerFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db'
import { parts, roles, userParts, users } from '../db/schema'
import { currentUser } from './access'
import { useAppSession } from './session'
import { DEMO_SHARE_TOKEN, isSeeded, resetDemoData, seedDemoData } from './seed'

export const getMe = createServerFn().handler(async () => {
  return currentUser()
})

export const getLoginPageData = createServerFn().handler(async () => {
  const demoMode = env.DEMO_MODE === 'true'
  if (!demoMode) return { demoMode, seeded: true, personas: [], demoShareToken: null }

  const seeded = await isSeeded()
  if (!seeded) return { demoMode, seeded, personas: [], demoShareToken: null }

  const d = db()
  const rows = await d
    .select({
      id: users.id,
      name: users.name,
      roleId: users.roleId,
      roleName: roles.name,
      partName: parts.nameNo,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .leftJoin(userParts, eq(userParts.userId, users.id))
    .leftJoin(parts, eq(userParts.partId, parts.id))
    .orderBy(users.createdAt)

  const personas = new Map<string, { id: string; name: string; roleId: string; roleName: string; parts: string[] }>()
  for (const r of rows) {
    const p = personas.get(r.id) ?? { id: r.id, name: r.name, roleId: r.roleId, roleName: r.roleName, parts: [] }
    if (r.partName) p.parts.push(r.partName)
    personas.set(r.id, p)
  }

  return {
    demoMode,
    seeded,
    personas: [...personas.values()],
    demoShareToken: DEMO_SHARE_TOKEN,
  }
})

export const loginAsPersona = createServerFn({ method: 'POST' })
  .validator(z.object({ userId: z.string().min(1) }))
  .handler(async ({ data }) => {
    if (env.DEMO_MODE !== 'true') throw new Error('Persona-innlogging er kun tilgjengelig i demo')
    const d = db()
    const row = await d.select({ id: users.id }).from(users).where(eq(users.id, data.userId)).limit(1)
    if (!row[0]) throw new Error('Ukjent bruker')
    const session = await useAppSession()
    await session.update({ userId: row[0].id })
    return { ok: true }
  })

export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  const session = await useAppSession()
  await session.clear()
  return { ok: true }
})

export const runDemoSeed = createServerFn({ method: 'POST' }).handler(async () => {
  return seedDemoData()
})

export const runDemoReset = createServerFn({ method: 'POST' }).handler(async () => {
  const result = await resetDemoData()
  const session = await useAppSession()
  await session.clear()
  return result
})
