import { useEffect, useState } from 'react'
import type { projects } from '../db/schema'
import { createProject, updateProject } from '../server/projects'
import { toast, toastError } from './toast'
import { Button, Field, Modal } from './ui'

type Project = typeof projects.$inferSelect

const KINDS = [
  { value: 'konsert', label: 'Konsert' },
  { value: 'konkurranse', label: 'Konkurranse' },
  { value: 'seminar', label: 'Seminar' },
  { value: 'annet', label: 'Annet' },
] as const

export function ProjectFormModal({
  open,
  onClose,
  onSaved,
  project,
}: {
  open: boolean
  onClose: () => void
  onSaved: (id: string) => void | Promise<void>
  project?: Project
}) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<(typeof KINDS)[number]['value']>('konsert')
  const [eventDate, setEventDate] = useState('')
  const [venue, setVenue] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(project?.name ?? '')
    setKind((project?.kind as typeof kind) ?? 'konsert')
    setEventDate(project?.eventDate ?? '')
    setVenue(project?.venue ?? '')
    setDescription(project?.description ?? '')
  }, [open, project])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !eventDate) {
      toast('Navn og dato må fylles ut', 'error')
      return
    }
    setSaving(true)
    try {
      if (project) {
        await updateProject({
          data: { id: project.id, name, kind, eventDate, venue: venue || null, description: description || null },
        })
        toast('Prosjektet er oppdatert')
        await onSaved(project.id)
      } else {
        const res = await createProject({
          data: { name, kind, eventDate, venue: venue || undefined, description: description || undefined },
        })
        toast('Prosjektet er opprettet — legg til repertoar')
        await onSaved(res.id)
      }
    } catch (err) {
      toastError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={project ? 'Rediger prosjekt' : 'Nytt prosjekt'} kicker="Prosjekter">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Navn *">
          <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Julekonsert, NM Brass …" autoFocus />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Type">
            <select className="field-input" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Dato *">
            <input type="date" className="field-input" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Sted">
          <input className="field-input" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Åsane kulturhus" />
        </Field>
        <Field label="Beskrivelse" hint="Vises til musikerne — oppmøte, antrekk, praktisk info">
          <textarea className="field-input min-h-20 resize-y" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose} className="w-full sm:w-auto">
            Avbryt
          </Button>
          <Button type="submit" variant="primary" loading={saving} className="w-full sm:w-auto">
            {project ? 'Lagre endringer' : 'Opprett prosjekt'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
