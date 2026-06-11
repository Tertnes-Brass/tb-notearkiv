import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { toast, toastError } from '../../components/toast'
import { Avatar, Kicker, Stamp } from '../../components/ui'
import { SECTION_LABELS } from '../../lib/taxonomy'
import { listMembers, updateMemberParts, updateMemberRole } from '../../server/members'

export const Route = createFileRoute('/medlemmer/')({
  beforeLoad: ({ context }) => {
    if (!context.me) throw redirect({ to: '/login' })
  },
  loader: () => listMembers(),
  component: MembersPage,
})

function MembersPage() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)

  // Grupper etter seksjonen til primærstemmen
  const groups = new Map<string, typeof data.members>()
  for (const m of data.members) {
    const primary = m.parts[0]
    const section = primary ? (data.allParts.find((p) => p.id === primary.id)?.section ?? 'other') : 'other'
    const list = groups.get(section) ?? []
    list.push(m)
    groups.set(section, list)
  }
  const order = ['cornet', 'horn', 'trombone', 'low', 'perc', 'other']
  const labels: Record<string, string> = { ...SECTION_LABELS, other: 'Stab og uten stemme' }

  const setPart = async (userId: string, partId: string) => {
    setBusyId(userId)
    try {
      await updateMemberParts({ data: { userId, partIds: partId ? [partId] : [] } })
      toast('Stemme oppdatert')
      await router.invalidate()
    } catch (err) {
      toastError(err)
    } finally {
      setBusyId(null)
    }
  }

  const setRole = async (userId: string, roleId: string) => {
    setBusyId(userId)
    try {
      await updateMemberRole({ data: { userId, roleId } })
      toast('Rolle oppdatert')
      await router.invalidate()
    } catch (err) {
      toastError(err)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-9">
      <header className="rise">
        <Kicker className="mb-2">Besetningen</Kicker>
        <h1 className="display-title text-4xl font-semibold italic text-ink sm:text-5xl">Medlemmer</h1>
        <p className="mt-2 text-sm text-ink-soft">
          {data.members.length} musikere og stab.{' '}
          {data.canManage ? 'Du kan endre stemmer og roller.' : 'Du kan endre din egen stemme.'}
        </p>
      </header>

      {order
        .filter((key) => groups.has(key))
        .map((key, si) => (
          <section key={key} className="rise" style={{ animationDelay: `${80 + si * 50}ms` }}>
            <div className="mb-3 flex items-baseline gap-3">
              <h2 className="kicker">{labels[key]}</h2>
              <div className="staff-rule h-[10px] flex-1 opacity-30" aria-hidden />
            </div>
            <ul className="sheet divide-y divide-[var(--line)] overflow-hidden">
              {groups.get(key)!.map((m) => {
                const canEditThis = data.canManage || m.id === data.meId
                return (
                  <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
                    <Avatar name={m.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[0.92rem] font-semibold text-ink">{m.name}</span>
                        {m.id === data.meId && <Stamp tone="brass">deg</Stamp>}
                      </span>
                      <span className="block truncate font-mono text-[0.64rem] text-ink-faint">{m.email}</span>
                    </span>

                    {canEditThis ? (
                      <select
                        className="field-input !w-auto !py-1.5 !text-xs"
                        value={m.parts[0]?.id ?? ''}
                        disabled={busyId === m.id}
                        onChange={(e) => setPart(m.id, e.target.value)}
                      >
                        <option value="">Ingen stemme</option>
                        {data.allParts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nameNo}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="font-mono text-[0.68rem] uppercase tracking-[0.1em] text-ink-soft">
                        {m.parts.map((p) => p.name).join(' · ') || '—'}
                      </span>
                    )}

                    {data.canManage ? (
                      <select
                        className="field-input !w-auto !py-1.5 !text-xs"
                        value={m.roleId}
                        disabled={busyId === m.id}
                        onChange={(e) => setRole(m.id, e.target.value)}
                      >
                        {data.allRoles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Stamp tone={m.roleId === 'member' ? 'neutral' : 'brass'}>{m.roleName}</Stamp>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
    </div>
  )
}
