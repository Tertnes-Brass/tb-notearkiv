/**
 * Seeder PRODUKSJONS-instansen (remote D1 + R2) med demodata.
 *
 *   pnpm seed:remote            — seeder hvis databasen er tom
 *   pnpm seed:remote --force    — hopper over tom-sjekken
 *
 * Kjøres lokalt: PDF-generering skjer på din maskin og lastes opp med
 * wrangler, fordi Workers gratisplan ikke har CPU-budsjett til å generere
 * 210 PDF-er i én request (in-app-seeding er derfor kun for lokal dev).
 */
import { createHash, webcrypto } from 'node:crypto'
import { execFileSync, execFile } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { BRASS_BAND_PARTS } from '../src/lib/taxonomy'
import { youTubeSearchUrl } from '../src/lib/youtube'
import { generateDemoPartPdf } from '../src/server/pdf'
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
} from '../src/server/seed-data'

const execFileAsync = promisify(execFile)
const DB_NAME = 'tb-notearkiv'
const BUCKET = 'tb-notearkiv-files'
const OUT_DIR = '.seed-tmp'

const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz'
function newId(): string {
  const bytes = webcrypto.getRandomValues(new Uint8Array(24))
  let out = ''
  for (const b of bytes) out += ALPHABET[b % 32]
  return out
}

function sqlStr(v: string | null): string {
  if (v == null) return 'NULL'
  return `'${v.replace(/'/g, "''")}'`
}
function sqlNum(v: number | null): string {
  return v == null ? 'NULL' : String(v)
}

function wrangler(args: string[]): string {
  return execFileSync('pnpm', ['exec', 'wrangler', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

async function main() {
  const force = process.argv.includes('--force')

  // ---------- Sikkerhetssjekk: er databasen tom? ----------
  const check = wrangler(['d1', 'execute', DB_NAME, '--remote', '--json', '--command', 'SELECT count(*) AS n FROM users'])
  const existing = JSON.parse(check)[0].results[0].n as number
  if (existing > 0 && !force) {
    console.error(`Remote-databasen har allerede ${existing} brukere. Kjør med --force for å seede likevel.`)
    process.exit(1)
  }

  rmSync(OUT_DIR, { recursive: true, force: true })
  mkdirSync(join(OUT_DIR, 'files'), { recursive: true })

  const ts = Date.now()
  const sql: string[] = []

  // ---------- Roller, rettigheter, besetning ----------
  for (const r of SEED_ROLES) sql.push(`INSERT INTO roles (id, name, is_system) VALUES (${sqlStr(r.id)}, ${sqlStr(r.name)}, 1);`)
  for (const rp of SEED_ROLE_PERMISSIONS)
    sql.push(`INSERT INTO role_permissions (role_id, permission) VALUES (${sqlStr(rp.roleId)}, ${sqlStr(rp.permission)});`)
  for (const p of BRASS_BAND_PARTS)
    sql.push(
      `INSERT INTO parts (id, sort_order, name_no, name_en, aliases, section) VALUES (${sqlStr(p.id)}, ${p.sortOrder}, ${sqlStr(p.nameNo)}, ${sqlStr(p.nameEn)}, ${sqlStr(JSON.stringify(p.aliases))}, ${sqlStr(p.section)});`,
    )

  // ---------- Medlemmer ----------
  const members = SEED_MEMBERS.map((m) => ({ ...m, id: newId() }))
  for (const m of members) {
    sql.push(
      `INSERT INTO users (id, name, email, password_hash, google_id, role_id, is_active, created_at) VALUES (${sqlStr(m.id)}, ${sqlStr(m.name)}, ${sqlStr(m.email)}, NULL, NULL, ${sqlStr(m.roleId)}, 1, ${ts});`,
    )
    for (const partId of m.partIds)
      sql.push(`INSERT INTO user_parts (user_id, part_id, is_primary) VALUES (${sqlStr(m.id)}, ${sqlStr(partId)}, 1);`)
  }
  const admin = members[0]!

  // ---------- Verk + lyttelenker ----------
  const seedWorks = SEED_WORKS.map((sw) => ({ ...sw, id: newId() }))
  for (const sw of seedWorks) {
    sql.push(
      `INSERT INTO works (id, title, composer, arranger, publisher, genre, grade, duration_sec, physical_location, acquired_year, notes, status, created_at, updated_at) VALUES (${sqlStr(sw.id)}, ${sqlStr(sw.title)}, ${sqlStr(sw.composer)}, ${sqlStr(sw.arranger)}, ${sqlStr(sw.publisher)}, ${sqlStr(sw.genre)}, ${sqlNum(sw.grade)}, ${sqlNum(sw.durationSec)}, ${sqlStr(sw.physicalLocation)}, ${sqlNum(sw.acquiredYear)}, ${sqlStr(sw.notes)}, 'active', ${ts}, ${ts});`,
    )
    sql.push(
      `INSERT INTO work_links (id, work_id, kind, url, label) VALUES (${sqlStr(newId())}, ${sqlStr(sw.id)}, 'other', ${sqlStr(youTubeSearchUrl(`${sw.title} brass band ${sw.composer ?? ''}`))}, 'Finn innspilling på YouTube');`,
    )
  }
  const workIdByTitle = new Map(seedWorks.map((sw) => [sw.title, sw.id]))

  // ---------- Sesonger, prosjekter, vikarlenke ----------
  const seasonRows = SEED_SEASONS.map((s) => ({ ...s, id: newId() }))
  for (const s of seasonRows)
    sql.push(`INSERT INTO seasons (id, name, starts_on, ends_on) VALUES (${sqlStr(s.id)}, ${sqlStr(s.name)}, ${sqlStr(s.startsOn)}, ${sqlStr(s.endsOn)});`)
  const seasonId = new Map(seasonRows.map((s) => [s.name, s.id]))

  for (const sp of SEED_PROJECTS) {
    const projectId = newId()
    sql.push(
      `INSERT INTO projects (id, season_id, name, kind, event_date, venue, description, is_published, created_at) VALUES (${sqlStr(projectId)}, ${sqlStr(seasonId.get(sp.seasonName)!)}, ${sqlStr(sp.name)}, ${sqlStr(sp.kind)}, ${sqlStr(sp.eventDate)}, ${sqlStr(sp.venue)}, ${sqlStr(sp.description)}, ${sp.isPublished ? 1 : 0}, ${ts});`,
    )
    for (const [title, position, note] of sp.repertoire)
      sql.push(
        `INSERT INTO project_works (project_id, work_id, position, note) VALUES (${sqlStr(projectId)}, ${sqlStr(workIdByTitle.get(title)!)}, ${position}, ${sqlStr(note)});`,
      )
    if (sp.name === 'Sommerkonsert') {
      const tokenHash = createHash('sha256').update(DEMO_SHARE_TOKEN).digest('hex')
      sql.push(
        `INSERT INTO share_links (id, project_id, token_hash, recipient_name, part_ids, expires_at, created_by, created_at, last_used_at, revoked_at) VALUES (${sqlStr(newId())}, ${sqlStr(projectId)}, ${sqlStr(tokenHash)}, ${sqlStr(DEMO_SHARE_RECIPIENT)}, ${sqlStr(JSON.stringify(DEMO_SHARE_PART_IDS))}, ${Date.parse(DEMO_SHARE_EXPIRES)}, ${sqlStr(admin.id)}, ${ts}, NULL, NULL);`,
      )
    }
  }

  // ---------- PDF-er ----------
  console.log('Genererer PDF-er …')
  const uploads: Array<{ key: string; path: string }> = []
  let n = 0
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
      const localPath = join(OUT_DIR, 'files', `${fileId}.pdf`)
      writeFileSync(localPath, bytes)
      uploads.push({ key: r2Key, path: localPath })
      sql.push(
        `INSERT INTO work_files (id, work_id, kind, part_id, label, r2_key, file_name, file_size, page_count, uploaded_by, uploaded_at) VALUES (${sqlStr(fileId)}, ${sqlStr(sw.id)}, ${sqlStr(isScore ? 'score' : 'part')}, ${sqlStr(part.id)}, NULL, ${sqlStr(r2Key)}, ${sqlStr(`${sw.title} - ${part.nameEn}.pdf`)}, ${bytes.byteLength}, ${isScore ? 4 : 2}, ${sqlStr(admin.id)}, ${ts});`,
      )
      if (++n % 50 === 0) console.log(`  ${n} PDF-er generert`)
    }
  }
  console.log(`  ${n} PDF-er totalt`)

  sql.push(`INSERT INTO settings (key, value) VALUES ('bandName', 'Tertnes Brass');`)
  sql.push(`INSERT INTO settings (key, value) VALUES ('demoSeededAt', ${sqlStr(new Date(ts).toISOString())});`)

  const sqlPath = join(OUT_DIR, 'seed.sql')
  writeFileSync(sqlPath, sql.join('\n'))
  console.log(`Skrev ${sql.length} SQL-setninger til ${sqlPath}`)

  // ---------- Kjør mot remote D1 ----------
  console.log('Setter inn rader i remote D1 …')
  wrangler(['d1', 'execute', DB_NAME, '--remote', '--file', sqlPath])

  // ---------- Last opp til R2 (begrenset parallellitet) ----------
  console.log(`Laster opp ${uploads.length} filer til R2 …`)
  let done = 0
  const queue = [...uploads]
  async function worker() {
    while (queue.length > 0) {
      const u = queue.shift()!
      await execFileAsync('pnpm', [
        'exec', 'wrangler', 'r2', 'object', 'put', `${BUCKET}/${u.key}`,
        '--file', u.path, '--content-type', 'application/pdf', '--remote',
      ])
      if (++done % 25 === 0) console.log(`  ${done}/${uploads.length}`)
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))
  console.log(`  ${done}/${uploads.length} — ferdig`)

  rmSync(OUT_DIR, { recursive: true, force: true })
  console.log('✅ Remote demodata er på plass.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
