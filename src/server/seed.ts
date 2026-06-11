import { env } from 'cloudflare:workers'
import { db } from '../db'
import {
  downloadLog,
  parts,
  projectWorks,
  projects,
  rolePermissions,
  roles,
  seasons,
  settings,
  shareLinks,
  userParts,
  users,
  workFiles,
  workLinks,
  works,
} from '../db/schema'
import { BRASS_BAND_PARTS } from '../lib/taxonomy'
import { newId, sha256Hex } from '../lib/id'
import { youTubeSearchUrl } from '../lib/youtube'
import { generateDemoPartPdf } from './pdf'

/** Fast vikartoken i demo, så vikarvisningen kan demonstreres uten oppsett. */
export const DEMO_SHARE_TOKEN = 'demo-vikar-sommerkonsert'

const now = () => new Date()

type SeedWork = {
  id: string
  title: string
  composer: string | null
  arranger: string | null
  publisher: string | null
  genre: string | null
  grade: number | null
  durationSec: number | null
  acquiredYear: number | null
  physicalLocation: string | null
  notes: string | null
  tempoText: string
}

export async function isSeeded(): Promise<boolean> {
  const d = db()
  const row = await d.select({ id: users.id }).from(users).limit(1)
  return row.length > 0
}

export async function seedDemoData(): Promise<{ ok: boolean; alreadySeeded?: boolean }> {
  if (env.DEMO_MODE !== 'true') throw new Error('Seeding er kun tilgjengelig i demo-modus')
  if (await isSeeded()) return { ok: true, alreadySeeded: true }

  const d = db()
  const ts = now()

  // ---------- Roller og rettigheter ----------
  await d.insert(roles).values([
    { id: 'admin', name: 'Administrator' },
    { id: 'archivist', name: 'Arkivar' },
    { id: 'conductor', name: 'Dirigent' },
    { id: 'member', name: 'Musiker' },
  ])
  await d.insert(rolePermissions).values([
    { roleId: 'admin', permission: '*' },
    { roleId: 'archivist', permission: 'works.manage' },
    { roleId: 'archivist', permission: 'projects.manage' },
    { roleId: 'archivist', permission: 'shares.manage' },
    { roleId: 'archivist', permission: 'scores.view' },
    { roleId: 'conductor', permission: 'works.manage' },
    { roleId: 'conductor', permission: 'projects.manage' },
    { roleId: 'conductor', permission: 'shares.manage' },
    { roleId: 'conductor', permission: 'scores.view' },
    { roleId: 'member', permission: 'scores.view' },
  ])

  // ---------- Besetning ----------
  await chunked(
    BRASS_BAND_PARTS.map((p) => ({
      id: p.id,
      sortOrder: p.sortOrder,
      nameNo: p.nameNo,
      nameEn: p.nameEn,
      aliases: JSON.stringify(p.aliases),
      section: p.section,
    })),
    10,
    (rows) => d.insert(parts).values(rows),
  )

  // ---------- Medlemmer ----------
  const members: Array<{ id: string; name: string; email: string; roleId: string; partIds: string[] }> = [
    { id: newId(), name: 'Sindre Ryland', email: 'sindre@demo.tertnesbrass.no', roleId: 'admin', partIds: ['euphonium'] },
    { id: newId(), name: 'Eirik Berge', email: 'dirigent@demo.tertnesbrass.no', roleId: 'conductor', partIds: [] },
    { id: newId(), name: 'Ingrid Marie Dale', email: 'ingrid@demo.tertnesbrass.no', roleId: 'member', partIds: ['solo-cornet'] },
    { id: newId(), name: 'Jonas Helle', email: 'jonas@demo.tertnesbrass.no', roleId: 'member', partIds: ['second-cornet'] },
    { id: newId(), name: 'Astrid Fjeldstad', email: 'astrid@demo.tertnesbrass.no', roleId: 'member', partIds: ['flugel'] },
    { id: newId(), name: 'Karim Aly', email: 'karim@demo.tertnesbrass.no', roleId: 'member', partIds: ['eb-bass'] },
    { id: newId(), name: 'Silje Tveit', email: 'silje@demo.tertnesbrass.no', roleId: 'member', partIds: ['percussion-1'] },
    { id: newId(), name: 'Ole Kristian Bø', email: 'ole@demo.tertnesbrass.no', roleId: 'archivist', partIds: ['bass-trombone'] },
  ]
  await d.insert(users).values(
    members.map((m) => ({ id: m.id, name: m.name, email: m.email, roleId: m.roleId, createdAt: ts })),
  )
  await d.insert(userParts).values(
    members.flatMap((m) => m.partIds.map((partId) => ({ userId: m.id, partId, isPrimary: true }))),
  )
  const sindre = members[0]!

  // ---------- Verk ----------
  const w = (input: Omit<SeedWork, 'id'>): SeedWork => ({ id: newId(), ...input })
  const seedWorks: SeedWork[] = [
    w({ title: 'Where Eagles Sing', composer: 'Paul Lovatt-Cooper', arranger: null, publisher: null, genre: 'Konsertåpner', grade: 3, durationSec: 300, acquiredYear: 2019, physicalLocation: 'Skap 1 · Mappe 041', notes: null, tempoText: 'Vivace' }),
    w({ title: 'I Dovregubbens hall', composer: 'Edvard Grieg', arranger: 'Ray Farr', publisher: null, genre: 'Klassisk', grade: 3, durationSec: 210, acquiredYear: 2015, physicalLocation: 'Skap 1 · Mappe 012', notes: null, tempoText: 'Alla marcia, poco a poco accelerando' }),
    w({ title: 'Benedictus', composer: 'Karl Jenkins', arranger: 'Tony Small', publisher: 'Boosey & Hawkes', genre: 'Hymne', grade: 3, durationSec: 420, acquiredYear: 2017, physicalLocation: 'Skap 1 · Mappe 027', notes: 'Husk soloist-stemme til euphonium.', tempoText: 'Andante sostenuto' }),
    w({ title: 'Cry of the Celts', composer: 'Ronan Hardiman', arranger: 'Peter Graham', publisher: 'Gramercy Music', genre: 'Suite', grade: 3, durationSec: 480, acquiredYear: 2019, physicalLocation: 'Skap 2 · Mappe 008', notes: null, tempoText: 'Misterioso' }),
    w({ title: 'Sætergjentens søndag', composer: 'Ole Bull', arranger: null, publisher: 'Norsk Noteservice', genre: 'Norsk perle', grade: 2, durationSec: 240, acquiredYear: 2020, physicalLocation: 'Skap 1 · Mappe 055', notes: null, tempoText: 'Adagio cantabile' }),
    w({ title: 'Tico-Tico no Fubá', composer: 'Zequinha de Abreu', arranger: 'Sandy Smith', publisher: null, genre: 'Latin', grade: 4, durationSec: 200, acquiredYear: 2022, physicalLocation: 'Skap 2 · Mappe 019', notes: 'Brukes gjerne som ekstranummer.', tempoText: 'Presto' }),
    w({ title: 'Gaelforce', composer: 'Peter Graham', arranger: null, publisher: 'Gramercy Music', genre: 'Konsertverk', grade: 4, durationSec: 660, acquiredYear: 2018, physicalLocation: 'Skap 1 · Mappe 003', notes: 'Original 2. kornett-stemme mangler — kopi ligger i mappen.', tempoText: 'Maestoso' }),
    w({ title: 'Vitae Aeternum', composer: 'Paul Lovatt-Cooper', arranger: null, publisher: null, genre: 'Konsertverk', grade: 4, durationSec: 540, acquiredYear: 2021, physicalLocation: 'Skap 2 · Mappe 031', notes: null, tempoText: 'Adagio — Allegro' }),
    w({ title: 'Shine as the Light', composer: 'Peter Graham', arranger: null, publisher: 'SP&S', genre: 'Konsertverk', grade: 3, durationSec: 330, acquiredYear: 2016, physicalLocation: 'Skap 1 · Mappe 022', notes: null, tempoText: 'Allegro deciso' }),
    w({ title: 'Amazing Grace', composer: 'Trad.', arranger: 'William Himes', publisher: null, genre: 'Hymne', grade: 2, durationSec: 260, acquiredYear: 2010, physicalLocation: 'Skap 1 · Mappe 001', notes: null, tempoText: 'Lento espressivo' }),
  ]
  await chunked(
    seedWorks.map((sw) => ({
      id: sw.id,
      title: sw.title,
      composer: sw.composer,
      arranger: sw.arranger,
      publisher: sw.publisher,
      genre: sw.genre,
      grade: sw.grade,
      durationSec: sw.durationSec,
      acquiredYear: sw.acquiredYear,
      physicalLocation: sw.physicalLocation,
      notes: sw.notes,
      status: 'active' as const,
      createdAt: ts,
      updatedAt: ts,
    })),
    5,
    (rows) => d.insert(works).values(rows),
  )

  // Lyttelenker (YouTube-søk — ekte innspillingslenker limes inn i demoen)
  await d.insert(workLinks).values(
    seedWorks.map((sw) => ({
      id: newId(),
      workId: sw.id,
      kind: 'other',
      url: youTubeSearchUrl(`${sw.title} brass band ${sw.composer ?? ''}`),
      label: 'Finn innspilling på YouTube',
    })),
  )

  // ---------- Sesonger og prosjekter ----------
  const season26v = { id: newId(), name: 'Vår 2026', startsOn: '2026-01-01', endsOn: '2026-07-31' }
  const season27v = { id: newId(), name: 'Vår 2027', startsOn: '2027-01-01', endsOn: '2027-07-31' }
  await d.insert(seasons).values([season26v, season27v])

  const byTitle = (t: string) => seedWorks.find((sw) => sw.title === t)!.id
  const projSommer = {
    id: newId(),
    seasonId: season26v.id,
    name: 'Sommerkonsert',
    kind: 'konsert',
    eventDate: '2026-06-24',
    venue: 'Åsane kulturhus',
    description: 'Sesongavslutning med sommerlig program. Oppmøte kl. 17:30, antrekk: sort med sommersløyfe.',
    isPublished: true,
    createdAt: ts,
  }
  const proj17mai = {
    id: newId(),
    seasonId: season26v.id,
    name: '17. mai',
    kind: 'konsert',
    eventDate: '2026-05-17',
    venue: 'Tertnes',
    description: 'Morgenspilling og folketog.',
    isPublished: true,
    createdAt: ts,
  }
  const projNM = {
    id: newId(),
    seasonId: season27v.id,
    name: 'NM Brass 2027',
    kind: 'konkurranse',
    eventDate: '2027-02-12',
    venue: 'Grieghallen, Bergen',
    description: 'Utkast til konkurranseprogram — ikke publisert til medlemmene ennå.',
    isPublished: false,
    createdAt: ts,
  }
  await d.insert(projects).values([projSommer, proj17mai, projNM])

  await d.insert(projectWorks).values([
    { projectId: projSommer.id, workId: byTitle('Where Eagles Sing'), position: 1, note: null },
    { projectId: projSommer.id, workId: byTitle('I Dovregubbens hall'), position: 2, note: null },
    { projectId: projSommer.id, workId: byTitle('Benedictus'), position: 3, note: 'Solist: eufonium' },
    { projectId: projSommer.id, workId: byTitle('Cry of the Celts'), position: 4, note: null },
    { projectId: projSommer.id, workId: byTitle('Sætergjentens søndag'), position: 5, note: null },
    { projectId: projSommer.id, workId: byTitle('Tico-Tico no Fubá'), position: 6, note: 'Ekstranummer' },
    { projectId: proj17mai.id, workId: byTitle('Amazing Grace'), position: 1, note: null },
    { projectId: proj17mai.id, workId: byTitle('Gaelforce'), position: 2, note: null },
    { projectId: proj17mai.id, workId: byTitle('Sætergjentens søndag'), position: 3, note: null },
    { projectId: projNM.id, workId: byTitle('Vitae Aeternum'), position: 1, note: 'Selvvalgt verk' },
  ])

  // ---------- Notefiler (genererte demo-PDF-er) ----------
  const fileRows: Array<typeof workFiles.$inferInsert> = []
  for (const sw of seedWorks) {
    const composerLine = [sw.composer, sw.arranger ? `arr. ${sw.arranger}` : null].filter(Boolean).join(' · ')
    for (const part of BRASS_BAND_PARTS) {
      const isScore = part.id === 'score'
      const bytes = await generateDemoPartPdf({
        title: sw.title,
        composerLine: composerLine || 'Ukjent',
        partLabel: part.nameEn,
        tempoText: sw.tempoText,
        pages: isScore ? 4 : 2,
      })
      const fileId = newId()
      const r2Key = `works/${sw.id}/${fileId}.pdf`
      await env.FILES.put(r2Key, bytes)
      fileRows.push({
        id: fileId,
        workId: sw.id,
        kind: isScore ? 'score' : 'part',
        partId: part.id,
        label: null,
        r2Key,
        fileName: `${sw.title} - ${part.nameEn}.pdf`,
        fileSize: bytes.byteLength,
        pageCount: isScore ? 4 : 2,
        uploadedBy: sindre.id,
        uploadedAt: ts,
      })
    }
  }
  await chunked(fileRows, 8, (rows) => d.insert(workFiles).values(rows))

  // ---------- Demovikarlenke ----------
  await d.insert(shareLinks).values({
    id: newId(),
    projectId: projSommer.id,
    tokenHash: await sha256Hex(DEMO_SHARE_TOKEN),
    recipientName: 'Ola Vikar',
    partIds: JSON.stringify(['solo-cornet']),
    expiresAt: new Date(Date.parse('2026-07-24T12:00:00Z')),
    createdBy: sindre.id,
    createdAt: ts,
  })

  await d.insert(settings).values([
    { key: 'bandName', value: 'Tertnes Brass' },
    { key: 'demoSeededAt', value: ts.toISOString() },
  ])

  return { ok: true }
}

/** Sletter alt demoinnhold (DB + R2) slik at demoen kan nullstilles. */
export async function resetDemoData(): Promise<{ ok: boolean }> {
  if (env.DEMO_MODE !== 'true') throw new Error('Reset er kun tilgjengelig i demo-modus')
  const d = db()

  const allFiles = await d.select({ r2Key: workFiles.r2Key }).from(workFiles)
  for (const batch of chunkArray(allFiles.map((f) => f.r2Key), 50)) {
    await env.FILES.delete(batch)
  }

  // Slett i avhengighetsrekkefølge
  await d.delete(downloadLog)
  await d.delete(shareLinks)
  await d.delete(projectWorks)
  await d.delete(projects)
  await d.delete(seasons)
  await d.delete(workLinks)
  await d.delete(workFiles)
  await d.delete(works)
  await d.delete(userParts)
  await d.delete(users)
  await d.delete(rolePermissions)
  await d.delete(roles)
  await d.delete(parts)
  await d.delete(settings)
  return { ok: true }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function chunked<T>(rows: T[], size: number, insert: (rows: T[]) => Promise<unknown>) {
  for (const batch of chunkArray(rows, size)) {
    await insert(batch)
  }
}
