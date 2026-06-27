/**
 * Ren, runtime-uavhengig logikk for stemme-treet (nøstede stemmer).
 * Holdes fri for importer (db, auth m.m.) så den kan enhetstestes i node.
 *
 * Modell: `parts.parentId` er en nullable self-FK. En forelder-stemme
 * (parentId = null, men har barn) som «Slagverk» dekker understemmene sine
 * (Slagverk 1/2/3 …). Tildeles en bruker en forelder, ekspanderes tilgangen
 * til hele subtreet. Partitur-raden ('score') er aldri del av treet.
 *
 * Brukes som ÉN sannhetskilde for ekspansjon — av effektive stemmer for et
 * medlem, ledelsesomfang for en seksjonsleder, og snapshot av vikar-deling.
 */

// Defensivt dybdetak. Praktisk besetning er maks 2 nivåer; taket sikrer at en
// patologisk/feilkonfigurert parentId-kjede aldri kan løkke uendelig.
export const MAX_PART_DEPTH = 3

export type PartNode = { id: string; parentId?: string | null }

/** parentId → direkte barn-id-er. Ekskluderer 'score' eksplisitt fra treet. */
export function buildChildrenMap(rows: PartNode[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const r of rows) {
    if (r.id === 'score') continue
    if (!r.parentId || r.parentId === 'score') continue
    const list = map.get(r.parentId) ?? []
    list.push(r.id)
    map.set(r.parentId, list)
  }
  return map
}

/**
 * Transitiv lukking nedover: gitt et sett tildelte stemmer, returnér settet av
 * alle stemmer brukeren effektivt har tilgang til (seg selv + alle etterkommere).
 * Sykel-vern via visited-set + hard dybdegrense, så ingen parentId-konfig kan
 * henge beregningen. 'score' tas aldri med. Identitet når treet er flatt
 * (alle parentId = null) — dvs. dagens oppførsel inntil noen bygger et tre.
 */
export function expandPartIds(rawIds: string[], childrenMap: Map<string, string[]>): string[] {
  const out = new Set<string>()
  const stack: Array<{ id: string; depth: number }> = []
  for (const id of rawIds) {
    if (id !== 'score') stack.push({ id, depth: 0 })
  }
  while (stack.length > 0) {
    const { id, depth } = stack.pop()!
    if (out.has(id)) continue // sykel-vern
    out.add(id)
    if (depth >= MAX_PART_DEPTH) continue
    for (const child of childrenMap.get(id) ?? []) {
      if (!out.has(child)) stack.push({ id: child, depth: depth + 1 })
    }
  }
  return [...out]
}
