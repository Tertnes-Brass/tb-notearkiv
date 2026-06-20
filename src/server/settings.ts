import { createServerFn } from '@tanstack/react-start'
import { asc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db'
import { invitations, memberProfiles, parts, rolePermissions, roles, userParts, workFiles } from '../db/schema'
import { requirePermission } from './access'

const SETTINGS_PERMISSION = 'settings.manage'

/** Kjente rettigheter med norske etiketter — vises i rolle-matrisen. */
export const PERMISSION_CATALOG: Array<{ key: string; label: string; hint: string }> = [
  { key: 'works.manage', label: 'Verk og filer', hint: 'Opprette, redigere og laste opp i arkivet' },
  { key: 'projects.manage', label: 'Prosjekter', hint: 'Lage prosjekter, sette repertoar, publisere' },
  { key: 'shares.manage', label: 'Vikarlenker', hint: 'Dele stemmer med vikarer' },
  { key: 'members.manage', label: 'Medlemmer', hint: 'Invitere og endre roller/stemmer' },
  { key: 'scores.view', label: 'Partitur', hint: 'Se og laste ned partitur' },
  { key: SETTINGS_PERMISSION, label: 'Innstillinger', hint: 'Administrere besetning og roller' },
]

const SECTIONS = ['cornet', 'horn', 'trombone', 'low', 'perc', 'score'] as const

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // kombinerende diakritiske tegn
      .replace(/[æ]/g, 'a')
      .replace(/ø/g, 'o')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'stemme'
  )
}

export const getSettingsData = createServerFn().handler(async () => {
  await requirePermission(SETTINGS_PERMISSION)
  const d = db()

  const [allParts, allRoles, perms, partFileCounts, partMemberCounts, roleMemberCounts, roleInviteCounts] =
    await Promise.all([
      d.select().from(parts).orderBy(asc(parts.sortOrder)),
      d.select().from(roles).orderBy(asc(roles.name)),
      d.select().from(rolePermissions),
      d
        .select({ partId: workFiles.partId, n: sql<number>`count(*)` })
        .from(workFiles)
        .groupBy(workFiles.partId),
      d.select({ partId: userParts.partId, n: sql<number>`count(*)` }).from(userParts).groupBy(userParts.partId),
      d
        .select({ roleId: memberProfiles.roleId, n: sql<number>`count(*)` })
        .from(memberProfiles)
        .groupBy(memberProfiles.roleId),
      d.select({ roleId: invitations.roleId, n: sql<number>`count(*)` }).from(invitations).groupBy(invitations.roleId),
    ])

  const fileCount = new Map(partFileCounts.map((r) => [r.partId, r.n]))
  const memberPartCount = new Map(partMemberCounts.map((r) => [r.partId, r.n]))
  const roleMembers = new Map(roleMemberCounts.map((r) => [r.roleId, r.n]))
  const roleInvites = new Map(roleInviteCounts.map((r) => [r.roleId, r.n]))
  const permsByRole = new Map<string, string[]>()
  for (const p of perms) {
    const list = permsByRole.get(p.roleId) ?? []
    list.push(p.permission)
    permsByRole.set(p.roleId, list)
  }

  return {
    parts: allParts.map((p) => ({
      id: p.id,
      sortOrder: p.sortOrder,
      nameNo: p.nameNo,
      nameEn: p.nameEn,
      section: p.section,
      aliases: JSON.parse(p.aliases) as string[],
      inUse: (fileCount.get(p.id) ?? 0) + (memberPartCount.get(p.id) ?? 0),
      fileCount: fileCount.get(p.id) ?? 0,
    })),
    roles: allRoles.map((r) => ({
      id: r.id,
      name: r.name,
      isSystem: r.isSystem,
      isAdmin: (permsByRole.get(r.id) ?? []).includes('*'),
      permissions: permsByRole.get(r.id) ?? [],
      memberCount: (roleMembers.get(r.id) ?? 0) + (roleInvites.get(r.id) ?? 0),
    })),
    permissionCatalog: PERMISSION_CATALOG,
    sections: SECTIONS,
  }
})

// ---------- Besetning (parts) ----------

const partInput = z.object({
  nameNo: z.string().min(1, 'Norsk navn er påkrevd'),
  nameEn: z.string().min(1, 'Engelsk navn er påkrevd'),
  section: z.enum(SECTIONS),
  aliases: z.array(z.string()).default([]),
})

export const createPart = createServerFn({ method: 'POST' })
  .validator(partInput)
  .handler(async ({ data }) => {
    await requirePermission(SETTINGS_PERMISSION)
    const d = db()
    // Unik slug fra engelsk navn
    let id = slugify(data.nameEn)
    const existing = new Set((await d.select({ id: parts.id }).from(parts)).map((p) => p.id))
    if (existing.has(id)) {
      let i = 2
      while (existing.has(`${id}-${i}`)) i++
      id = `${id}-${i}`
    }
    const maxRow = await d.select({ m: sql<number>`coalesce(max(sort_order), 0)` }).from(parts)
    await d.insert(parts).values({
      id,
      sortOrder: (maxRow[0]?.m ?? 0) + 10,
      nameNo: data.nameNo.trim(),
      nameEn: data.nameEn.trim(),
      section: data.section,
      aliases: JSON.stringify(data.aliases.map((a) => a.trim()).filter(Boolean)),
    })
    return { id }
  })

export const updatePart = createServerFn({ method: 'POST' })
  .validator(partInput.extend({ id: z.string() }))
  .handler(async ({ data }) => {
    await requirePermission(SETTINGS_PERMISSION)
    await db()
      .update(parts)
      .set({
        nameNo: data.nameNo.trim(),
        nameEn: data.nameEn.trim(),
        section: data.section,
        aliases: JSON.stringify(data.aliases.map((a) => a.trim()).filter(Boolean)),
      })
      .where(eq(parts.id, data.id))
    return { ok: true }
  })

export const deletePart = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    await requirePermission(SETTINGS_PERMISSION)
    const d = db()
    const files = await d
      .select({ n: sql<number>`count(*)` })
      .from(workFiles)
      .where(eq(workFiles.partId, data.id))
    if ((files[0]?.n ?? 0) > 0) {
      throw new Error(`Stemmen er i bruk på ${files[0]!.n} fil(er). Flytt eller slett dem først.`)
    }
    // user_parts fjernes via cascade
    await d.delete(parts).where(eq(parts.id, data.id))
    return { ok: true }
  })

export const movePart = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string(), direction: z.enum(['up', 'down']) }))
  .handler(async ({ data }) => {
    await requirePermission(SETTINGS_PERMISSION)
    const d = db()
    const rows = await d.select({ id: parts.id, sortOrder: parts.sortOrder }).from(parts).orderBy(asc(parts.sortOrder))
    const idx = rows.findIndex((r) => r.id === data.id)
    const swapWith = data.direction === 'up' ? idx - 1 : idx + 1
    if (idx === -1 || swapWith < 0 || swapWith >= rows.length) return { ok: true }
    const a = rows[idx]!
    const b = rows[swapWith]!
    await d.update(parts).set({ sortOrder: b.sortOrder }).where(eq(parts.id, a.id))
    await d.update(parts).set({ sortOrder: a.sortOrder }).where(eq(parts.id, b.id))
    return { ok: true }
  })

// ---------- Roller og rettigheter ----------

export const setRolePermission = createServerFn({ method: 'POST' })
  .validator(z.object({ roleId: z.string(), permission: z.string(), enabled: z.boolean() }))
  .handler(async ({ data }) => {
    await requirePermission(SETTINGS_PERMISSION)
    if (!PERMISSION_CATALOG.some((p) => p.key === data.permission)) throw new Error('Ukjent rettighet')
    const d = db()
    const role = (await d.select().from(roles).where(eq(roles.id, data.roleId)).limit(1))[0]
    if (!role) throw new Error('Ukjent rolle')
    // Admin-rollen («*») er alltid full tilgang og kan ikke finjusteres.
    const current = await d.select().from(rolePermissions).where(eq(rolePermissions.roleId, data.roleId))
    if (current.some((p) => p.permission === '*')) {
      throw new Error('Administrator har alltid full tilgang og kan ikke endres')
    }
    if (data.enabled) {
      await d.insert(rolePermissions).values({ roleId: data.roleId, permission: data.permission }).onConflictDoNothing()
    } else {
      await d
        .delete(rolePermissions)
        .where(sql`${rolePermissions.roleId} = ${data.roleId} and ${rolePermissions.permission} = ${data.permission}`)
    }
    return { ok: true }
  })

export const createRole = createServerFn({ method: 'POST' })
  .validator(z.object({ name: z.string().min(1, 'Navn er påkrevd') }))
  .handler(async ({ data }) => {
    await requirePermission(SETTINGS_PERMISSION)
    const d = db()
    let id = slugify(data.name)
    const existing = new Set((await d.select({ id: roles.id }).from(roles)).map((r) => r.id))
    if (existing.has(id)) {
      let i = 2
      while (existing.has(`${id}-${i}`)) i++
      id = `${id}-${i}`
    }
    await d.insert(roles).values({ id, name: data.name.trim(), isSystem: false })
    return { id }
  })

export const renameRole = createServerFn({ method: 'POST' })
  .validator(z.object({ roleId: z.string(), name: z.string().min(1) }))
  .handler(async ({ data }) => {
    await requirePermission(SETTINGS_PERMISSION)
    await db().update(roles).set({ name: data.name.trim() }).where(eq(roles.id, data.roleId))
    return { ok: true }
  })

export const deleteRole = createServerFn({ method: 'POST' })
  .validator(z.object({ roleId: z.string() }))
  .handler(async ({ data }) => {
    await requirePermission(SETTINGS_PERMISSION)
    const d = db()
    const role = (await d.select().from(roles).where(eq(roles.id, data.roleId)).limit(1))[0]
    if (!role) return { ok: true }
    if (role.isSystem) throw new Error('Systemroller kan ikke slettes')
    const members = await d
      .select({ n: sql<number>`count(*)` })
      .from(memberProfiles)
      .where(eq(memberProfiles.roleId, data.roleId))
    const invites = await d
      .select({ n: sql<number>`count(*)` })
      .from(invitations)
      .where(eq(invitations.roleId, data.roleId))
    if ((members[0]?.n ?? 0) + (invites[0]?.n ?? 0) > 0) {
      throw new Error('Rollen er i bruk. Flytt medlemmer/invitasjoner til en annen rolle først.')
    }
    await d.delete(roles).where(eq(roles.id, data.roleId)) // role_permissions via cascade
    return { ok: true }
  })
