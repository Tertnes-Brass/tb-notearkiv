import { eq } from 'drizzle-orm'
import { redirect } from '@tanstack/react-router'
import { db } from '../db'
import { parts, rolePermissions, roles, userParts, users } from '../db/schema'
import { useAppSession } from './session'

export type Me = {
  id: string
  name: string
  email: string
  roleId: string
  roleName: string
  permissions: string[]
  parts: Array<{ id: string; nameNo: string; nameEn: string; section: string }>
}

export async function currentUser(): Promise<Me | null> {
  const session = await useAppSession()
  const userId = session.data.userId
  if (!userId) return null

  const d = db()
  const rows = await d
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      roleId: users.roleId,
      roleName: roles.name,
      isActive: users.isActive,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, userId))
    .limit(1)

  const user = rows[0]
  if (!user || !user.isActive) return null

  const [perms, myParts] = await Promise.all([
    d
      .select({ permission: rolePermissions.permission })
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, user.roleId)),
    d
      .select({ id: parts.id, nameNo: parts.nameNo, nameEn: parts.nameEn, section: parts.section })
      .from(userParts)
      .innerJoin(parts, eq(userParts.partId, parts.id))
      .where(eq(userParts.userId, user.id)),
  ])

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roleId: user.roleId,
    roleName: user.roleName,
    permissions: perms.map((p) => p.permission),
    parts: myParts,
  }
}

export function hasPermission(me: Me | null, permission: string): boolean {
  if (!me) return false
  return me.permissions.includes('*') || me.permissions.includes(permission)
}

/** Krever innlogget bruker — ellers redirect til /login. */
export async function requireMe(): Promise<Me> {
  const me = await currentUser()
  if (!me) throw redirect({ to: '/login' })
  return me
}

/** Krever en spesifikk rettighet — ellers feil (vises som melding i UI). */
export async function requirePermission(permission: string): Promise<Me> {
  const me = await requireMe()
  if (!hasPermission(me, permission)) {
    throw new Error(`Du mangler tilgangen «${permission}»`)
  }
  return me
}
