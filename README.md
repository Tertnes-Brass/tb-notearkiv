# Tertnes Brass · Notearkiv

Notearkiv, publisering og deling av noter for brass band — bygget for [Tertnes Brass](https://tertnesbrass.no), tenkt delt med andre korps etter hvert.

**Idéen:** Arkivaren katalogiserer verkene én gang, med PDF per stemme. Deretter er en ny konsert bare å klikke sammen et program — hvert medlem ser *sine* stemmer («Mine noter»), og vikarer får en tidsbegrenset lenke med kun sine stemmer, uten innlogging.

> **Status: fase 1 — i produksjon på [noter.tertnesbrass.com](https://noter.tertnesbrass.com)** (invitasjonsbasert).
> Kjørbar lokalt uten Cloudflare-konto. All demodata er kunstig (inkl. genererte note-PDF-er) — ingen rettighetsbelagte noter i repoet.

## Funksjoner

- **Verksarkiv** — katalog med komponist/arrangør, grad, varighet, fysisk plassering, søk
- **Stemme-gjenkjenning** — slipp 20 PDF-er på et verk; stemmen gjettes fra filnavnet («Gaelforce – 2nd Cornet.pdf» → 2. kornett, norske og engelske navn)
- **Prosjekter** — sesonger, program i rekkefølge, publisering (utkast er kun synlig for stab)
- **Mine noter** — medlemmet ser neste konsert med direktelenker til egne stemmer, partitur og lytteeksempler (YouTube/lyd)
- **Vikarlenker** — del valgte stemmer for ett prosjekt; lenken utløper automatisk og kan trekkes tilbake; kun hash av tokenet lagres
- **Innlogging** — [better-auth](https://better-auth.com): magisk e-postlenke + passord, invitasjonsbasert (ingen åpen registrering). Google kan legges til senere.
- **RBAC** — roller (admin/arkivar/dirigent/musiker) med rettigheter i database, håndhevet server-side i alle funksjoner
- **Tilgangsstyrte filer** — alle PDF-er streames via API med sesjons- eller token-sjekk; partitur er rettighetsstyrt (scores.view); ingen offentlige filer

## Innlogging og invitasjon

Ingen kan registrere seg selv. Flyten er:

1. **Første admin** bootstrappes via `ADMIN_EMAIL` (wrangler.jsonc) — første innlogging med den adressen blir automatisk admin.
2. Admin **inviterer** medlemmer (e-post + rolle + stemme) under *Medlemmer*. En innloggingslenke sendes på e-post (eller del-en-lenke via Spond hvis e-post ikke er satt opp).
3. Medlemmet logger inn med **magisk lenke** (skriv e-post → klikk lenke) eller setter et passord.

## Kom i gang (lokalt)

```bash
pnpm install
cp .dev.vars.example .dev.vars          # sett ADMIN_EMAIL til din e-post
pnpm exec wrangler d1 migrations apply tb-notearkiv --local
pnpm dev
```

Seed besetning + roller + demoinnhold (kun i dev): `curl -X POST http://localhost:3000/api/dev-seed`.
I dev sendes ikke e-post — magiske lenker skrives til serverkonsollen (og miniflares e-postmappe), så du kan klikke dem derfra. Logg inn med `ADMIN_EMAIL` for admin, eller en av de seedede demo-adressene (f.eks. `jonas@demo.tertnesbrass.no`).

Nullstill lokalt ved å slette `.wrangler/state` og kjøre migreringen på nytt.

## Auth-skjema

better-auth eier `user`/`session`/`account`/`verification` (generert til `src/db/auth-schema.ts` med `pnpm auth:generate`). RBAC ligger i egne tabeller: `member_profiles` (1:1 mot `user.id`, rolle + aktiv-status), `roles`, `role_permissions`, `parts`, `user_parts`, og `invitations`.

## Stack

| Lag | Valg |
|---|---|
| Rammeverk | [TanStack Start](https://tanstack.com/start) (React, SSR + server functions) |
| Hosting | [Cloudflare Workers](https://developers.cloudflare.com/workers/) (gratisplan) |
| Database | Cloudflare D1 (SQLite) + [Drizzle ORM](https://orm.drizzle.team) |
| Fillagring | Cloudflare R2 (privat bucket, gratis egress) |
| Styling | Tailwind CSS v4, eget design-system («Konsertprogrammet») |
| PDF | pdf-lib (sidetelling + demo-generering) |

Begrunnelse, datamodell og veikart: se [PLAN.md](PLAN.md).

## Deploy til Cloudflare

```bash
pnpm exec wrangler d1 create tb-notearkiv           # legg database_id inn i wrangler.jsonc
pnpm exec wrangler r2 bucket create tb-notearkiv-files
pnpm exec wrangler d1 migrations apply tb-notearkiv --remote
pnpm exec wrangler secret put BETTER_AUTH_SECRET    # `openssl rand -base64 32`
pnpm exec wrangler email sending enable tertnesbrass.com # magisk lenke + reset (dashboard hvis token mangler scope)
pnpm run deploy                                      # sett ADMIN_EMAIL + BETTER_AUTH_URL i wrangler.jsonc først
```

Logg så inn med `ADMIN_EMAIL`-adressen (blir admin automatisk) og inviter resten. Custom domene (`noter.tertnesbrass.com`) som ikke skal være bak Cloudflare Access må ha en egen Access-app med **Bypass / Everyone**, ellers blokkeres besøkende.

## Backup og gjenoppretting

Notearkivet er uerstattelig, så det sikres på flere uavhengige lag:

| Lag | Hva | Hvor |
|---|---|---|
| D1 PITR | Innebygd point-in-time recovery, 30 dager | Cloudflare |
| Ukentlig SQL-dump | Cron skriver hele databasen som SQL til R2 | R2 `backups/` (8 siste uker) |
| Off-site | Kopi av notefiler + dumper til uavhengig lokasjon | Backblaze B2 / lokal disk |

### Automatisk ukentlig dump (cron)

En [Cron Trigger](wrangler.jsonc) (`0 4 * * 0` — søndag 04:00 UTC) kaller `scheduled()`-handleren i [src/server.ts](src/server.ts), som kjører [`runBackup()`](src/server/backup.ts). Den dumper hele D1-en (skjema + data, samme format som `sqlite3 .dump`) til R2 under `backups/tb-notearkiv-<ISO>.sql` og roterer ut alt eldre enn de 8 nyeste. Dumpen er selvstendig — den bruker kun `DB`- og `FILES`-bindingene, ingen ekstra secrets.

Resultatet logges til Workers-observability: `[backup] OK trigger=… key=… tabeller=… rader=… bytes=…`.

Test cron-handleren lokalt (vite-dev forwarder `/cdn-cgi/handler/*` til Worker-en):

```bash
pnpm dev                                                   # i ett terminalvindu
curl "http://localhost:3000/cdn-cgi/handler/scheduled?cron=0+4+*+*+0"
# → se "[backup] OK …" i dev-loggen; dumpen havner i lokal R2 (.wrangler/state)
```

### Manuell dump

```bash
pnpm backup:export        # wrangler d1 export tb-notearkiv --remote → backups/manual-<dato>.sql
```

### Off-site-kopi (rclone)

[scripts/offsite-sync.sh](scripts/offsite-sync.sh) speiler R2 til en uavhengig lokasjon med [rclone](https://rclone.org): SQL-dumpene kopieres additivt (beholdes for alltid), notefilene speiles. Engangsoppsett av R2- og B2-/disk-remotes er dokumentert øverst i scriptet. Kjør manuelt eller planlagt:

```bash
brew install rclone                                        # + rclone config (se scriptet)
OFFSITE="offsite:min-b2-bucket" pnpm backup:offsite        # eller OFFSITE=/Volumes/Backup/...
```

Planlegg det f.eks. via `launchd`/`cron` på en alltid-på maskin, eller en GitHub Actions-jobb (ukentlig, med R2-/B2-nøkler som repo-secrets) som kjører `scripts/offsite-sync.sh` etter at Worker-cron-en har lagt en fersk dump i R2.

### Restore-test — *en utestet backup er bare et håp*

[scripts/restore-test.sh](scripts/restore-test.sh) gjenoppretter en dump til en **fersk, tom SQLite-database**, kjører `integrity_check` + `foreign_key_check`, og skriver ut tabeller med radtall (og sjekker at kjernetabellene finnes):

```bash
scripts/restore-test.sh backups/manual-2026-06-21T0400Z.sql      # en lokal dumpfil
scripts/restore-test.sh --r2-key backups/tb-notearkiv-2026-06-21T0400Z.sql --remote   # hent fra prod-R2
```

Faktisk gjenoppretting til en ny D1 (ved katastrofe):

```bash
wrangler d1 create tb-notearkiv                                  # ny/tom database
wrangler r2 object get tb-notearkiv-files/backups/<dump>.sql --file restore.sql --remote
wrangler d1 execute tb-notearkiv --remote --file restore.sql     # last inn dumpen
# verifiser, og oppdater database_id i wrangler.jsonc om id-en endret seg
```

## Veikart (kort)

- **Fase 1 (gjort)** — better-auth (magisk lenke + passord, invitasjonsbasert), e-post via Cloudflare, prod på noter.tertnesbrass.com, automatiske ukentlige backups (D1-dump → R2 + off-site via rclone)
- **Neste** — Google-innlogging, import fra dagens Google Sheets/Drive
- **Fase 2** — PDF-splitter i nettleser (samle-PDF → stemmer), ZIP-nedlasting, e-postvarsler, nedlastingslogg-UI
- **Fase 3** — «deploy your own»-dokumentasjon for andre korps, besetning som konfigurasjon (janitsjar m.m.), lisensvalg

## Lisens

Ikke avklart ennå — AGPL-3.0 vurderes (åpen kildekode med mulighet for hostet tjeneste). Ta kontakt før gjenbruk.
