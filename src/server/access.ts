import { eq } from 'drizzle-orm'
import { redirect } from '@tanstack/react-router'
import { getRequest } from '@tanstack/react-start/server'
import { db } from '../db'
import { memberProfiles, parts, rolePermissions, roles, userParts } from '../db/schema'
import { getAuth } from './auth-instance'

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
  const { headers } = getRequest()
  const session = await getAuth().api.getSession({ headers })
  if (!session?.user) return null

  const authUserId = session.user.id
  const d = db()

  const rows = await d
    .select({
      roleId: memberProfiles.roleId,
      roleName: roles.name,
      isActive: memberProfiles.isActive,
    })
    .from(memberProfiles)
    .innerJoin(roles, eq(memberProfiles.roleId, roles.id))
    .where(eq(memberProfiles.authUserId, authUserId))
    .limit(1)

  const profile = rows[0]
  if (!profile || !profile.isActive) return null

  const [perms, myParts] = await Promise.all([
    d
      .select({ permission: rolePermissions.permission })
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, profile.roleId)),
    d
      .select({ id: parts.id, nameNo: parts.nameNo, nameEn: parts.nameEn, section: parts.section })
      .from(userParts)
      .innerJoin(parts, eq(userParts.partId, parts.id))
      .where(eq(userParts.userId, authUserId)),
  ])

  return {
    id: authUserId,
    name: session.user.name,
    email: session.user.email,
    roleId: profile.roleId,
    roleName: profile.roleName,
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
