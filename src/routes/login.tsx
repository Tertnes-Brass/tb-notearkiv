import { Link, createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { Avatar, Button, Kicker, Stamp } from '../components/ui'
import { toastError } from '../components/toast'
import { getLoginPageData, loginAsPersona, runDemoSeed } from '../server/auth'

export const Route = createFileRoute('/login')({
  beforeLoad: ({ context }) => {
    if (context.me) throw redirect({ to: '/' })
  },
  loader: () => getLoginPageData(),
  component: LoginPage,
})

function LoginPage() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const [seeding, setSeeding] = useState(false)
  const [loggingIn, setLoggingIn] = useState<string | null>(null)

  const seed = async () => {
    setSeeding(true)
    try {
      await runDemoSeed()
      await router.invalidate()
    } catch (err) {
      toastError(err)
    } finally {
      setSeeding(false)
    }
  }

  const login = async (userId: string) => {
    setLoggingIn(userId)
    try {
      await loginAsPersona({ data: { userId } })
      await router.invalidate()
      await router.navigate({ to: '/' })
    } catch (err) {
      toastError(err)
      setLoggingIn(null)
    }
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-14">
      {/* Bakteppe: svake notelinjer øverst og nederst */}
      <div className="staff-rule absolute left-1/2 top-10 w-[min(520px,80vw)] -translate-x-1/2 opacity-30" aria-hidden />
      <div className="staff-rule absolute bottom-10 left-1/2 w-[min(520px,80vw)] -translate-x-1/2 opacity-30" aria-hidden />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[640px] -translate-x-1/2 rounded-full opacity-50"
        style={{ background: 'radial-gradient(closest-side, var(--brass-soft), transparent)' }}
      />

      <header className="rise relative mb-10 text-center">
        <Kicker className="mb-4">Tertnes Brass · siden 1969</Kicker>
        <h1 className="display-title text-[clamp(3rem,9vw,5.5rem)] font-semibold italic leading-[0.95] text-ink">
          Notearkivet
        </h1>
        <p className="mx-auto mt-4 max-w-md text-[0.95rem] leading-relaxed text-ink-soft">
          Alle stemmer, alle prosjekter, ett sted. Finn nota di på ti sekunder —
          eller del den med en vikar på tre.
        </p>
      </header>

      {!data.seeded ? (
        <section className="sheet rise relative w-full max-w-md px-7 py-8 text-center" style={{ animationDelay: '120ms' }}>
          <Kicker className="mb-2">Første gangs oppsett</Kicker>
          <h2 className="display-title mb-2 text-xl font-semibold">Klargjør demoen</h2>
          <p className="mb-6 text-sm leading-relaxed text-ink-soft">
            Fyller arkivet med ti verk, genererte stemme-PDF-er for hele besetningen,
            to konserter og en vikarlenke — alt lokalt i din egen database.
          </p>
          <Button variant="primary" onClick={seed} loading={seeding} className="w-full">
            {seeding ? 'Genererer demodata …' : 'Last inn demodata'}
          </Button>
          {seeding && (
            <p className="fadein mt-3 font-mono text-[0.66rem] uppercase tracking-[0.16em] text-ink-faint">
              210 notestemmer skrives … dette tar noen sekunder
            </p>
          )}
        </section>
      ) : (
        <section className="relative w-full max-w-3xl">
          <p className="rise mb-4 text-center font-mono text-[0.66rem] uppercase tracking-[0.2em] text-ink-faint" style={{ animationDelay: '100ms' }}>
            Velg hvem du vil se demoen som
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {data.personas.map((p, i) => (
              <button
                key={p.id}
                onClick={() => login(p.id)}
                disabled={loggingIn !== null}
                className="sheet sheet-hover rise group flex cursor-pointer items-center gap-4 px-5 py-4 text-left disabled:opacity-60"
                style={{ animationDelay: `${140 + i * 60}ms` }}
              >
                <Avatar name={p.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{p.name}</span>
                  <span className="mt-0.5 block truncate font-mono text-[0.64rem] uppercase tracking-[0.14em] text-ink-faint">
                    {p.parts.length > 0 ? p.parts.join(' · ') : 'Hele besetningen'}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <Stamp tone={p.roleId === 'member' ? 'neutral' : 'brass'}>{p.roleName}</Stamp>
                  {loggingIn === p.id ? (
                    <span className="spinner text-brass" />
                  ) : (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                      aria-hidden
                      className="text-ink-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-brass"
                    >
                      <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
              </button>
            ))}
          </div>

          {data.demoShareToken && (
            <p className="rise mt-8 text-center text-sm text-ink-soft" style={{ animationDelay: '500ms' }}>
              … eller se hva en vikar får:{' '}
              <Link to="/v/$token" params={{ token: data.demoShareToken }} className="link-brass">
                åpne vikarlenken til Ola
              </Link>
            </p>
          )}
        </section>
      )}

      <p className="rise relative mt-12 text-center font-mono text-[0.62rem] uppercase tracking-[0.18em] text-ink-faint" style={{ animationDelay: '600ms' }}>
        Demo-modus · innlogging uten passord · Google-innlogging kommer i fase 1
      </p>
    </main>
  )
}
