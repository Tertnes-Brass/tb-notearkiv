import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { toast, toastError } from '../../components/toast'
import { Avatar, Button, Field, Kicker, Modal, Stamp } from '../../components/ui'
import { SECTION_LABELS } from '../../lib/taxonomy'
import {
  inviteMember,
  listMembers,
  revokeInvitation,
  updateMemberParts,
  updateMemberRole,
} from '../../server/members'

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

  const [inviteOpen, setInviteOpen] = useState(false)

  return (
    <div className="space-y-9">
      <header className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <Kicker className="mb-2">Besetningen</Kicker>
          <h1 className="display-title text-4xl font-semibold italic text-ink sm:text-5xl">Medlemmer</h1>
          <p className="mt-2 text-sm text-ink-soft">
            {data.members.length} musikere og stab.{' '}
            {data.canManage ? 'Du kan invitere, og endre stemmer og roller.' : 'Du kan endre din egen stemme.'}
          </p>
        </div>
        {data.canManage && (
          <Button variant="primary" onClick={() => setInviteOpen(true)}>
            Inviter medlem
          </Button>
        )}
      </header>

      {data.canManage && data.invites.length > 0 && (
        <section className="rise">
          <div className="mb-3 flex items-baseline gap-3">
            <h2 className="kicker">Venter på første innlogging</h2>
            <div className="staff-rule h-[10px] flex-1 opacity-30" aria-hidden />
          </div>
          <ul className="sheet divide-y divide-[var(--line)] overflow-hidden">
            {data.invites.map((inv) => (
              <li key={inv.email} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 sm:px-5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.92rem] font-semibold text-ink">{inv.email}</span>
                  <span className="block font-mono text-[0.64rem] uppercase tracking-[0.1em] text-ink-faint">
                    {inv.roleName}
                    {inv.partNames.length > 0 ? ` · ${inv.partNames.join(' · ')}` : ''}
                  </span>
                </span>
                <Stamp tone="oxblood">Invitert</Stamp>
                <button
                  onClick={async () => {
                    try {
                      await revokeInvitation({ data: { email: inv.email } })
                      toast('Invitasjon trukket tilbake')
                      await router.invalidate()
                    } catch (err) {
                      toastError(err)
                    }
                  }}
                  className="cursor-pointer font-mono text-[0.64rem] uppercase tracking-wide text-danger/80 hover:text-danger"
                >
                  Trekk tilbake
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

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

      {data.canManage && (
        <InviteModal
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          allParts={data.allParts}
          allRoles={data.allRoles}
          onInvited={() => router.invalidate()}
        />
      )}
    </div>
  )
}

function InviteModal({
  open,
  onClose,
  allParts,
  allRoles,
  onInvited,
}: {
  open: boolean
  onClose: () => void
  allParts: Array<{ id: string; nameNo: string }>
  allRoles: Array<{ id: string; name: string }>
  onInvited: () => void
}) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [roleId, setRoleId] = useState('member')
  const [partId, setPartId] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      toast('Skriv inn en e-post', 'error')
      return
    }
    setSaving(true)
    try {
      const res = await inviteMember({
        data: { email: email.trim(), name: name.trim() || undefined, roleId, partIds: partId ? [partId] : [] },
      })
      toast(
        res.emailSent
          ? `Invitasjon sendt til ${email}`
          : `${email} er invitert — be dem logge inn på noter.saynain.com`,
      )
      setEmail('')
      setName('')
      setPartId('')
      setRoleId('member')
      onInvited()
      onClose()
    } catch (err) {
      toastError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Inviter medlem" kicker="Besetningen">
      <form onSubmit={submit} className="space-y-4">
        <Field label="E-post *" hint="Personen logger inn med denne adressen (e-postlenke eller Google senere)">
          <input
            type="email"
            className="field-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="navn@example.com"
            autoFocus
          />
        </Field>
        <Field label="Navn">
          <input
            className="field-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ola Nordmann"
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Rolle">
            <select className="field-input" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              {allRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Stemme">
            <select className="field-input" value={partId} onChange={(e) => setPartId(e.target.value)}>
              <option value="">Ingen / settes senere</option>
              {allParts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameNo}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Avbryt
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            Inviter
          </Button>
        </div>
      </form>
    </Modal>
  )
}
