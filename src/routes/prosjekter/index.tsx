import { Link, createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { ProjectFormModal } from '../../components/ProjectForm'
import { Button, EmptyState, Kicker, Stamp } from '../../components/ui'
import { formatDate, relativeDays } from '../../lib/format'
import { listProjects } from '../../server/projects'

export const Route = createFileRoute('/prosjekter/')({
  beforeLoad: ({ context }) => {
    if (!context.me) throw redirect({ to: '/login' })
  },
  loader: () => listProjects(),
  component: ProjectsPage,
})

const KIND_LABEL: Record<string, string> = {
  konsert: 'Konsert',
  konkurranse: 'Konkurranse',
  seminar: 'Seminar',
  annet: 'Annet',
}

function ProjectsPage() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const [creating, setCreating] = useState(false)

  const today = new Date().toISOString().slice(0, 10)
  const seasons = new Map<string, typeof data.projects>()
  for (const p of data.projects) {
    const key = p.seasonName ?? 'Uten sesong'
    const list = seasons.get(key) ?? []
    list.push(p)
    seasons.set(key, list)
  }

  return (
    <div className="space-y-9">
      <header className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <Kicker className="mb-2">Sesongene</Kicker>
          <h1 className="display-title text-4xl font-semibold italic text-ink sm:text-5xl">Prosjekter</h1>
        </div>
        {data.canManage && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            Nytt prosjekt
          </Button>
        )}
      </header>

      {data.projects.length === 0 ? (
        <div className="sheet rise">
          <EmptyState
            title="Ingen prosjekter ennå"
            action={
              data.canManage ? (
                <Button variant="primary" onClick={() => setCreating(true)}>
                  Opprett det første
                </Button>
              ) : undefined
            }
          >
            Prosjekter samler repertoar, noter og deling for en konsert eller konkurranse.
          </EmptyState>
        </div>
      ) : (
        [...seasons.entries()].map(([seasonName, projects], si) => (
          <section key={seasonName} className="rise" style={{ animationDelay: `${80 + si * 60}ms` }}>
            <div className="mb-3 flex items-baseline gap-3">
              <h2 className="kicker">{seasonName}</h2>
              <div className="staff-rule h-[10px] flex-1 opacity-30" aria-hidden />
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {projects.map((p) => {
                const isPast = (p.eventDate ?? '') < today
                return (
                  <li key={p.id}>
                    <Link
                      to="/prosjekter/$projectId"
                      params={{ projectId: p.id }}
                      className={`sheet sheet-hover link-quiet flex h-full items-center gap-5 px-5 py-4 ${isPast ? 'opacity-75' : ''}`}
                    >
                      <span className="flex w-12 shrink-0 flex-col items-center" aria-hidden>
                        <span className="display-title tabular text-[1.7rem] font-semibold leading-none text-ink">
                          {p.eventDate ? Number(p.eventDate.slice(8, 10)) : '–'}
                        </span>
                        <span className="font-mono text-[0.58rem] uppercase tracking-[0.18em] text-brass">
                          {p.eventDate ? formatDate(p.eventDate).split(' ')[1]?.slice(0, 3) : ''}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="display-title block truncate text-[1.15rem] font-semibold">{p.name}</span>
                        <span className="mt-0.5 block text-xs text-ink-soft">
                          {KIND_LABEL[p.kind] ?? p.kind}
                          {p.venue ? ` · ${p.venue}` : ''} · {p.workCount} verk
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1.5">
                        {!p.isPublished && <Stamp tone="oxblood">Utkast</Stamp>}
                        {!isPast && p.isPublished && (
                          <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-brass">
                            {relativeDays(p.eventDate)}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}

      <ProjectFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={async (id) => {
          setCreating(false)
          await router.invalidate()
          router.navigate({ to: '/prosjekter/$projectId', params: { projectId: id } })
        }}
      />
    </div>
  )
}
