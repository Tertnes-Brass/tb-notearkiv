import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { toast, toastError } from '../components/toast'
import { Button, Field, Kicker } from '../components/ui'
import { authClient } from '../lib/auth-client'

export const Route = createFileRoute('/login')({
  beforeLoad: ({ context }) => {
    if (context.me) throw redirect({ to: '/' })
  },
  component: LoginPage,
})

function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [sending, setSending] = useState(false)
  const [signingIn, setSigningIn] = useState(false)
  const [linkSent, setLinkSent] = useState(false)

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      toast('Skriv inn e-postadressen din', 'error')
      return
    }
    setSending(true)
    try {
      const { error } = await authClient.signIn.magicLink({ email: email.trim(), callbackURL: '/' })
      if (error) throw new Error(error.message ?? 'Kunne ikke sende lenke')
      setLinkSent(true)
    } catch (err) {
      toastError(err)
    } finally {
      setSending(false)
    }
  }

  const signInWithPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setSigningIn(true)
    try {
      const { error } = await authClient.signIn.email({ email: email.trim(), password })
      if (error) throw new Error(error.message ?? 'Feil e-post eller passord')
      await router.invalidate()
      await router.navigate({ to: '/' })
    } catch (err) {
      toastError(err)
    } finally {
      setSigningIn(false)
    }
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-14">
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
          Logg inn for å finne notene dine, kommende konserter og lytteeksempler.
        </p>
      </header>

      <section className="sheet rise relative w-full max-w-md px-7 py-8" style={{ animationDelay: '120ms' }}>
        {linkSent ? (
          <div className="text-center">
            <div className="staff-rule mx-auto mb-5 w-28 opacity-60" aria-hidden />
            <h2 className="display-title mb-2 text-xl font-semibold">Sjekk e-posten din</h2>
            <p className="text-sm leading-relaxed text-ink-soft">
              Vi har sendt en innloggingslenke til <strong className="text-ink">{email}</strong>. Den er
              gyldig i 30 minutter. Finner du den ikke, sjekk søppelpost.
            </p>
            <Button variant="ghost" className="mt-5" onClick={() => setLinkSent(false)}>
              Tilbake
            </Button>
          </div>
        ) : (
          <>
            <form onSubmit={sendMagicLink} className="space-y-4">
              <Field label="E-post">
                <input
                  type="email"
                  className="field-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="deg@example.com"
                  autoComplete="email"
                  autoFocus
                />
              </Field>
              {showPassword && (
                <Field label="Passord">
                  <input
                    type="password"
                    className="field-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </Field>
              )}

              {showPassword ? (
                <Button
                  type="button"
                  variant="primary"
                  className="w-full"
                  loading={signingIn}
                  onClick={signInWithPassword}
                >
                  Logg inn
                </Button>
              ) : (
                <Button type="submit" variant="primary" className="w-full" loading={sending}>
                  Send innloggingslenke
                </Button>
              )}
            </form>

            <div className="mt-5 text-center">
              <button
                onClick={() => setShowPassword((v) => !v)}
                className="cursor-pointer text-[0.8rem] text-ink-soft underline-offset-2 transition-colors hover:text-brass-strong hover:underline"
              >
                {showPassword ? '← Bruk e-postlenke i stedet' : 'Jeg har passord →'}
              </button>
            </div>
          </>
        )}
      </section>

      <p
        className="rise relative mt-12 max-w-sm text-center font-mono text-[0.62rem] uppercase leading-relaxed tracking-[0.16em] text-ink-faint"
        style={{ animationDelay: '300ms' }}
      >
        Kun for inviterte medlemmer · Google-innlogging kommer senere
      </p>
    </main>
  )
}
