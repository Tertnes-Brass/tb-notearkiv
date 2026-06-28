/**
 * Standard brass band-besetning. Seedes inn i `parts`-tabellen og brukes til
 * å gjette stemme fra filnavn ved opplasting. Ikke hardkodet i logikk ellers —
 * andre besetninger (janitsjar m.m.) kan seedes i stedet.
 */

export type PartDef = {
  id: string
  sortOrder: number
  nameNo: string
  nameEn: string
  aliases: string[]
  section: 'cornet' | 'horn' | 'trombone' | 'low' | 'perc' | 'score'
  // Valgfri forelder-stemme (nøsting). Udefinert = rotnode/selvstendig blad.
  parentId?: string
}

export const SECTION_LABELS: Record<PartDef['section'], string> = {
  cornet: 'Kornetter',
  horn: 'Horn',
  trombone: 'Tromboner',
  low: 'Grovmessing',
  perc: 'Slagverk',
  score: 'Partitur',
}

export const BRASS_BAND_PARTS: PartDef[] = [
  { id: 'soprano-cornet', sortOrder: 10, nameNo: 'Soprankornett', nameEn: 'Soprano Cornet', aliases: ['soprano cornet', 'soprano', 'sop cornet', 'eb cornet', 'soprankornett'], section: 'cornet' },
  { id: 'solo-cornet', sortOrder: 20, nameNo: 'Solokornett', nameEn: 'Solo Cornet', aliases: ['solo cornet', 'principal cornet', 'solokornett', '1st cornet', 'first cornet'], section: 'cornet' },
  { id: 'repiano-cornet', sortOrder: 30, nameNo: 'Repianokornett', nameEn: 'Repiano Cornet', aliases: ['repiano cornet', 'repiano', 'ripieno cornet'], section: 'cornet' },
  { id: 'second-cornet', sortOrder: 40, nameNo: '2. kornett', nameEn: '2nd Cornet', aliases: ['2nd cornet', 'second cornet', 'cornet 2', '2 kornett', 'kornett 2'], section: 'cornet' },
  { id: 'third-cornet', sortOrder: 50, nameNo: '3. kornett', nameEn: '3rd Cornet', aliases: ['3rd cornet', 'third cornet', 'cornet 3', '3 kornett', 'kornett 3'], section: 'cornet' },
  { id: 'flugel', sortOrder: 60, nameNo: 'Flygelhorn', nameEn: 'Flugel Horn', aliases: ['flugel horn', 'flugelhorn', 'flugel', 'flygelhorn'], section: 'cornet' },
  { id: 'solo-horn', sortOrder: 70, nameNo: 'Solohorn', nameEn: 'Solo Horn', aliases: ['solo horn', 'solohorn', 'solo eb horn'], section: 'horn' },
  { id: 'first-horn', sortOrder: 80, nameNo: '1. horn', nameEn: '1st Horn', aliases: ['1st horn', 'first horn', 'horn 1', '1 horn'], section: 'horn' },
  { id: 'second-horn', sortOrder: 90, nameNo: '2. horn', nameEn: '2nd Horn', aliases: ['2nd horn', 'second horn', 'horn 2', '2 horn'], section: 'horn' },
  { id: 'first-baritone', sortOrder: 100, nameNo: '1. baryton', nameEn: '1st Baritone', aliases: ['1st baritone', 'first baritone', 'baritone 1', '1 baryton'], section: 'low' },
  { id: 'second-baritone', sortOrder: 110, nameNo: '2. baryton', nameEn: '2nd Baritone', aliases: ['2nd baritone', 'second baritone', 'baritone 2', '2 baryton'], section: 'low' },
  { id: 'first-trombone', sortOrder: 120, nameNo: '1. trombone', nameEn: '1st Trombone', aliases: ['1st trombone', 'first trombone', 'trombone 1', '1 trombone'], section: 'trombone' },
  { id: 'second-trombone', sortOrder: 130, nameNo: '2. trombone', nameEn: '2nd Trombone', aliases: ['2nd trombone', 'second trombone', 'trombone 2', '2 trombone'], section: 'trombone' },
  { id: 'bass-trombone', sortOrder: 140, nameNo: 'Basstrombone', nameEn: 'Bass Trombone', aliases: ['bass trombone', 'basstrombone'], section: 'trombone' },
  { id: 'euphonium', sortOrder: 150, nameNo: 'Eufonium', nameEn: 'Euphonium', aliases: ['euphonium', 'eufonium', 'euph'], section: 'low' },
  { id: 'eb-bass', sortOrder: 160, nameNo: 'Eb-bass', nameEn: 'Eb Bass', aliases: ['eb bass', 'es bass', 'eb tuba', 'e bass'], section: 'low' },
  { id: 'bb-bass', sortOrder: 170, nameNo: 'Bb-bass', nameEn: 'Bb Bass', aliases: ['bb bass', 'b bass', 'bb tuba'], section: 'low' },
  { id: 'percussion-1', sortOrder: 180, nameNo: 'Slagverk 1', nameEn: 'Percussion 1', aliases: ['percussion 1', 'perc 1', 'slagverk 1', 'drum set', 'drumset', 'kit', 'snare', 'snare drum', 'skarptromme'], section: 'perc' },
  { id: 'percussion-2', sortOrder: 190, nameNo: 'Slagverk 2', nameEn: 'Percussion 2', aliases: ['percussion 2', 'perc 2', 'slagverk 2', 'mallets', 'glockenspiel', 'xylophone', 'xylofon', 'klokkespill'], section: 'perc' },
  { id: 'percussion-3', sortOrder: 200, nameNo: 'Slagverk 3', nameEn: 'Percussion 3', aliases: ['percussion 3', 'perc 3', 'slagverk 3', 'timpani', 'pauker', 'cymbals', 'cymbaler', 'triangle', 'triangel'], section: 'perc' },
  { id: 'score', sortOrder: 210, nameNo: 'Partitur', nameEn: 'Full Score', aliases: ['full score', 'score', 'partitur', 'conductor'], section: 'score' },
]

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\.(pdf|mp3|m4a|wav|musx|sib|xml|mxl)$/i, '')
    .replace(/[._\-()\[\],]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// «1st», «first», «1.» → «1». Slik koker «2nd cornet», «cornet 2» og
// «2. kornett» ned til samme token-sett.
const ORDINALS: Record<string, string> = {
  first: '1', '1st': '1',
  second: '2', '2nd': '2',
  third: '3', '3rd': '3',
  fourth: '4', '4th': '4',
}

function tokenize(s: string): string[] {
  return normalize(s)
    .split(' ')
    .filter(Boolean)
    .map((t) => ORDINALS[t] ?? t)
}

/**
 * Gjetter stemme fra et filnavn. Token-basert: et alias treffer når *alle* ordene
 * i aliaset finnes i filnavnet — uavhengig av rekkefølge og av «fyllord» imellom.
 * Slik treffer «1st Bb Baritone» aliaset «1st baritone» selv om tonarten «Bb»
 * står i veien, mens «Eb-bass»/«Bb-bass» fortsatt skilles fordi tonart-ordet da
 * er en del av selve aliaset. Mest spesifikke treff (flest ord) vinner.
 */
export function guessPartFromFilename(
  fileName: string,
  defs: Array<{ id: string; aliases: string[] | string; nameNo?: string; nameEn?: string }>,
): string | null {
  const hay = new Set(tokenize(fileName))
  let best: { id: string; tokens: number; len: number } | null = null
  for (const def of defs) {
    const aliasList = typeof def.aliases === 'string' ? (JSON.parse(def.aliases) as string[]) : def.aliases
    const candidates = [...aliasList, def.nameNo ?? '', def.nameEn ?? ''].filter(Boolean)
    for (const alias of candidates) {
      const tokens = tokenize(alias)
      if (tokens.length === 0 || !tokens.every((t) => hay.has(t))) continue
      const len = tokens.join(' ').length
      if (!best || tokens.length > best.tokens || (tokens.length === best.tokens && len > best.len)) {
        best = { id: def.id, tokens: tokens.length, len }
      }
    }
  }
  return best?.id ?? null
}

export function isAudioFilename(fileName: string): boolean {
  return /\.(mp3|m4a|wav|ogg|flac)$/i.test(fileName)
}
