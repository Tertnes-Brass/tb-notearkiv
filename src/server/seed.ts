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
import {
  DEMO_SHARE_EXPIRES,
  DEMO_SHARE_PART_IDS,
  DEMO_SHARE_RECIPIENT,
  DEMO_SHARE_TOKEN,
  SEED_MEMBERS,
  SEED_PROJECTS,
  SEED_ROLES,
  SEED_ROLE_PERMISSIONS,
  SEED_SEASONS,
  SEED_WORKS,
} from './seed-data'

export { DEMO_SHARE_TOKEN }

const now = () => new Date()

export async function isSeeded(): Promise<boolean> {
  const d = db()
  const row = await d.select({ id: users.id }).from(users).limit(1)
  return row.length > 0
}

/**
 * In-app-seeding for LOKAL utvikling (genererer 210 PDF-er i én request —
 * det er greit lokalt, men overskrider CPU-grensen på Workers gratisplan;
 * produksjon seedes derfor med `pnpm seed:remote` i stedet).
 */
export async function seedDemoData(): Promise<{ ok: boolean; alreadySeeded?: boolean }> {
  if (env.DEMO_MODE !== 'true') throw new Error('Seeding er kun tilgjengelig i demo-modus')
  if (await isSeeded()) return { ok: true, alreadySeeded: true }

  const d = db()
  const ts = now()

  // ---------- Roller og rettigheter ----------
  await d.insert(roles).values(SEED_ROLES.map((r) => ({ ...r })))
  await d.insert(rolePermissions).values(SEED_ROLE_PERMISSIONS)

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
  const members = SEED_MEMBERS.map((m) => ({ ...m, id: newId() }))
  await d.insert(users).values(
    members.map((m) => ({ id: m.id, name: m.name, email: m.email, roleId: m.roleId, createdAt: ts })),
  )
  await d.insert(userParts).values(
    members.flatMap((m) => m.partIds.map((partId) => ({ userId: m.id, partId, isPrimary: true }))),
  )
  const admin = members[0]!

  // ---------- Verk ----------
  const seedWorks = SEED_WORKS.map((sw) => ({ ...sw, id: newId() }))
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
  const seasonRows = SEED_SEASONS.map((s) => ({ ...s, id: newId() }))
  await d.insert(seasons).values(seasonRows)
  const seasonId = new Map(seasonRows.map((s) => [s.name, s.id]))
  const workIdByTitle = new Map(seedWorks.map((sw) => [sw.title, sw.id]))

  for (const sp of SEED_PROJECTS) {
    const projectId = newId()
    await d.insert(projects).values({
      id: projectId,
      seasonId: seasonId.get(sp.seasonName)!,
      name: sp.name,
      kind: sp.kind,
      eventDate: sp.eventDate,
      venue: sp.venue,
      description: sp.description,
      isPublished: sp.isPublished,
      createdAt: ts,
    })
    await d.insert(projectWorks).values(
      sp.repertoire.map(([title, position, note]) => ({
        projectId,
        workId: workIdByTitle.get(title)!,
        position,
        note,
      })),
    )
    if (sp.name === 'Sommerkonsert') {
      await d.insert(shareLinks).values({
        id: newId(),
        projectId,
        tokenHash: await sha256Hex(DEMO_SHARE_TOKEN),
        recipientName: DEMO_SHARE_RECIPIENT,
        partIds: JSON.stringify(DEMO_SHARE_PART_IDS),
        expiresAt: new Date(Date.parse(DEMO_SHARE_EXPIRES)),
        createdBy: admin.id,
        createdAt: ts,
      })
    }
  }

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
        uploadedBy: admin.id,
        uploadedAt: ts,
      })
    }
  }
  await chunked(fileRows, 8, (rows) => d.insert(workFiles).values(rows))

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
