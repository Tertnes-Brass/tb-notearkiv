import { createServerFn } from '@tanstack/react-start'
import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db'
import { parts, roles, userParts, users } from '../db/schema'
import { hasPermission, requireMe, requirePermission } from './access'

export const listMembers = createServerFn().handler(async () => {
  const me = await requireMe()
  const d = db()

  const rows = await d
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      roleId: users.roleId,
      roleName: roles.name,
      partId: parts.id,
      partName: parts.nameNo,
      partSort: parts.sortOrder,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .leftJoin(userParts, eq(userParts.userId, users.id))
    .leftJoin(parts, eq(userParts.partId, parts.id))
    .where(eq(users.isActive, true))

  const byId = new Map<
    string,
    { id: string; name: string; email: string; roleId: string; roleName: string; parts: Array<{ id: string; name: string; sort: number }> }
  >()
  for (const r of rows) {
    const m = byId.get(r.id) ?? { id: r.id, name: r.name, email: r.email, roleId: r.roleId, roleName: r.roleName, parts: [] }
    if (r.partId && r.partName) m.parts.push({ id: r.partId, name: r.partName, sort: r.partSort ?? 999 })
    byId.set(r.id, m)
  }

  const members = [...byId.values()].sort((a, b) => {
    const sa = a.parts[0]?.sort ?? 998
    const sb = b.parts[0]?.sort ?? 998
    return sa - sb || a.name.localeCompare(b.name, 'nb')
  })

  const allParts = await d.select().from(parts).orderBy(asc(parts.sortOrder))
  const allRoles = await d.select().from(roles)

  return {
    members,
    allParts: allParts.filter((p) => p.section !== 'score'),
    allRoles,
    canManage: hasPermission(me, 'members.manage'),
    meId: me.id,
  }
})

export const updateMemberParts = createServerFn({ method: 'POST' })
  .validator(z.object({ userId: z.string(), partIds: z.array(z.string()).max(4) }))
  .handler(async ({ data }) => {
    const me = await requireMe()
    if (me.id !== data.userId && !hasPermission(me, 'members.manage')) {
      throw new Error('Du kan bare endre din egen stemme')
    }
    const d = db()
    await d.delete(userParts).where(eq(userParts.userId, data.userId))
    if (data.partIds.length > 0) {
      await d.insert(userParts).values(
        data.partIds.map((partId, i) => ({ userId: data.userId, partId, isPrimary: i === 0 })),
      )
    }
    return { ok: true }
  })

export const updateMemberRole = createServerFn({ method: 'POST' })
  .validator(z.object({ userId: z.string(), roleId: z.string() }))
  .handler(async ({ data }) => {
    await requirePermission('members.manage')
    const d = db()
    await d.update(users).set({ roleId: data.roleId }).where(eq(users.id, data.userId))
    return { ok: true }
  })
