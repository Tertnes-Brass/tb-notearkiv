# Tertnes Brass · Notearkiv

Notearkiv, publisering og deling av noter for brass band — bygget for [Tertnes Brass](https://tertnesbrass.no), tenkt delt med andre korps etter hvert.

**Idéen:** Arkivaren katalogiserer verkene én gang, med PDF per stemme. Deretter er en ny konsert bare å klikke sammen et program — hvert medlem ser *sine* stemmer («Mine noter»), og vikarer får en tidsbegrenset lenke med kun sine stemmer, uten innlogging.

> **Status: demo / fase 1.** Kjørbar lokalt uten Cloudflare-konto. Demodata genereres ved første oppstart (inkl. kunstige note-PDF-er — ingen rettighetsbelagte noter i repoet).

## Funksjoner i demoen

- **Verksarkiv** — katalog med komponist/arrangør, grad, varighet, fysisk plassering, søk
- **Stemme-gjenkjenning** — slipp 20 PDF-er på et verk; stemmen gjettes fra filnavnet («Gaelforce – 2nd Cornet.pdf» → 2. kornett, norske og engelske navn)
- **Prosjekter** — sesonger, program i rekkefølge, publisering (utkast er kun synlig for stab)
- **Mine noter** — medlemmet ser neste konsert med direktelenker til egne stemmer, partitur og lytteeksempler (YouTube/lyd)
- **Vikarlenker** — del valgte stemmer for ett prosjekt; lenken utløper automatisk og kan trekkes tilbake; kun hash av tokenet lagres
- **RBAC** — roller (admin/arkivar/dirigent/musiker) med rettigheter i database, håndhevet i alle server-funksjoner
- **Tilgangsstyrte filer** — alle PDF-er streames via API med sesjons- eller token-sjekk; ingen offentlige filer

## Kom i gang (lokalt)

```bash
pnpm install
pnpm exec wrangler d1 migrations apply tb-notearkiv --local
pnpm dev
```

Åpne appen, trykk **«Last inn demodata»**, og velg en persona:

- **Sindre (administrator)** — full tilgang
- **Ole (arkivar)** / **Eirik (dirigent)** — verk, prosjekter og deling
- **Ingrid / Jonas / …(musikere)** — ser kun publiserte prosjekter og egne stemmer
- Vikarvisningen: lenken «åpne vikarlenken til Ola» på innloggingssiden

Demodata kan nullstilles ved å slette `.wrangler/state` og kjøre migreringen på nytt.

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
pnpm exec wrangler d1 create tb-notearkiv     # legg database_id inn i wrangler.jsonc
pnpm exec wrangler r2 bucket create tb-notearkiv-files
pnpm exec wrangler d1 migrations apply tb-notearkiv --remote
pnpm exec wrangler secret put SESSION_SECRET  # min. 32 tegn
pnpm run deploy
```

> ⚠️ `DEMO_MODE` i [wrangler.jsonc](wrangler.jsonc) skrur på persona-innlogging uten passord. Sett `"DEMO_MODE": "false"` for alt annet enn demo. Ekte innlogging (Google via better-auth) kommer i fase 1, se veikartet.

## Veikart (kort)

- **Fase 1** — better-auth med Google + passord, import fra dagens Google Sheets/Drive, backup-cron (D1-dump + rclone til off-site)
- **Fase 2** — PDF-splitter i nettleser (samle-PDF → stemmer), ZIP-nedlasting, e-postvarsler (Resend), nedlastingslogg-UI
- **Fase 3** — «deploy your own»-dokumentasjon for andre korps, besetning som konfigurasjon (janitsjar m.m.), lisensvalg

## Lisens

Ikke avklart ennå — AGPL-3.0 vurderes (åpen kildekode med mulighet for hostet tjeneste). Ta kontakt før gjenbruk.
