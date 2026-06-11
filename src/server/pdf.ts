import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

/**
 * Genererer en troverdig (men kunstig) notestemme som PDF, for demodata.
 * Innholdet er deterministisk per verk+stemme slik at regenerering gir samme fil.
 */

const A4: [number, number] = [595.28, 841.89]
const INK = rgb(0.12, 0.11, 0.1)
const SOFT = rgb(0.45, 0.43, 0.4)

function hashString(s: string): number {
  let h = 1779033703 ^ s.length
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return h >>> 0
}

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type StaveOpts = {
  page: PDFPage
  x: number
  y: number // toppen av notelinjen
  width: number
  rand: () => number
  boldFont: PDFFont
  italicFont: PDFFont
  rehearsalMark?: string
  dynamic?: string
}

const LINE_GAP = 7
const STAFF_HEIGHT = LINE_GAP * 4

function drawStave({ page, x, y, width, rand, boldFont, italicFont, rehearsalMark, dynamic }: StaveOpts) {
  for (let i = 0; i < 5; i++) {
    page.drawLine({
      start: { x, y: y - i * LINE_GAP },
      end: { x: x + width, y: y - i * LINE_GAP },
      thickness: 0.7,
      color: INK,
    })
  }

  const bars = 4
  const barWidth = width / bars
  for (let b = 0; b <= bars; b++) {
    page.drawLine({
      start: { x: x + b * barWidth, y },
      end: { x: x + b * barWidth, y: y - STAFF_HEIGHT },
      thickness: b === bars ? 1.4 : 0.8,
      color: INK,
    })
  }

  if (rehearsalMark) {
    const size = 9
    const w = boldFont.widthOfTextAtSize(rehearsalMark, size) + 8
    page.drawRectangle({
      x: x - 2,
      y: y + 6,
      width: w,
      height: 14,
      borderColor: INK,
      borderWidth: 0.9,
    })
    page.drawText(rehearsalMark, { x: x + 2, y: y + 9.5, size, font: boldFont, color: INK })
  }

  if (dynamic) {
    page.drawText(dynamic, {
      x: x + 4,
      y: y - STAFF_HEIGHT - 14,
      size: 11,
      font: italicFont,
      color: INK,
    })
  }

  // Noter: 3–6 hendelser per takt, plassert på linjer/mellomrom
  for (let b = 0; b < bars; b++) {
    const events = 3 + Math.floor(rand() * 4)
    const bx = x + b * barWidth
    for (let e = 0; e < events; e++) {
      const nx = bx + 14 + (e * (barWidth - 26)) / events + rand() * 6
      const stepsFromTop = Math.floor(rand() * 9) // 0..8 → linjer og mellomrom
      const ny = y - (stepsFromTop * LINE_GAP) / 2
      const isHalf = rand() < 0.14
      const stemUp = stepsFromTop > 4

      page.drawEllipse({
        x: nx,
        y: ny,
        xScale: 3.1,
        yScale: 2.3,
        ...(isHalf
          ? { borderColor: INK, borderWidth: 1.1, color: undefined }
          : { color: INK }),
      })
      page.drawLine({
        start: { x: nx + (stemUp ? 2.9 : -2.9), y: ny },
        end: { x: nx + (stemUp ? 2.9 : -2.9), y: ny + (stemUp ? 19 : -19) },
        thickness: 0.9,
        color: INK,
      })
      // av og til bjelke til neste note
      if (!isHalf && e < events - 1 && rand() < 0.4) {
        const nnx = bx + 14 + ((e + 1) * (barWidth - 26)) / events
        page.drawLine({
          start: { x: nx + (stemUp ? 2.9 : -2.9), y: ny + (stemUp ? 19 : -19) },
          end: { x: nnx + (stemUp ? 2.9 : -2.9), y: ny + (stemUp ? 19 : -19) },
          thickness: 2.4,
          color: INK,
        })
      }
    }
  }
}

export type DemoPdfInput = {
  title: string
  composerLine: string
  partLabel: string
  tempoText?: string
  pages?: number
}

export async function generateDemoPartPdf({
  title,
  composerLine,
  partLabel,
  tempoText = 'Allegro moderato',
  pages = 2,
}: DemoPdfInput): Promise<Uint8Array> {
  const rand = mulberry32(hashString(`${title}::${partLabel}`))
  const doc = await PDFDocument.create()
  const helv = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const boldItalic = await doc.embedFont(StandardFonts.HelveticaBoldOblique)
  const times = await doc.embedFont(StandardFonts.TimesRomanBold)

  const margin = 50
  const width = A4[0] - margin * 2
  const dynamics = ['p', 'mp', 'mf', 'f', 'ff', 'cresc.']
  const marks = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
  let markIndex = 0

  for (let p = 0; p < pages; p++) {
    const page = doc.addPage(A4)
    let y: number

    if (p === 0) {
      // Stemmeetikett øverst til venstre
      const label = partLabel.toUpperCase()
      const labelWidth = bold.widthOfTextAtSize(label, 10) + 16
      page.drawRectangle({
        x: margin,
        y: 791,
        width: labelWidth,
        height: 20,
        borderColor: INK,
        borderWidth: 1,
      })
      page.drawText(label, { x: margin + 8, y: 797, size: 10, font: bold, color: INK })

      page.drawText(composerLine, {
        x: A4[0] - margin - helv.widthOfTextAtSize(composerLine, 10),
        y: 797,
        size: 10,
        font: helv,
        color: INK,
      })

      const titleSize = 23
      page.drawText(title, {
        x: (A4[0] - times.widthOfTextAtSize(title, titleSize)) / 2,
        y: 742,
        size: titleSize,
        font: times,
        color: INK,
      })
      const sub = 'Brass Band'
      page.drawText(sub, {
        x: (A4[0] - helv.widthOfTextAtSize(sub, 10)) / 2,
        y: 726,
        size: 10,
        font: helv,
        color: SOFT,
      })

      page.drawText(tempoText, { x: margin, y: 690, size: 12, font: boldItalic, color: INK })
      page.drawText('4/4', { x: margin + 6, y: 662, size: 11, font: bold, color: INK })
      y = 668
    } else {
      y = 770
    }

    while (y - STAFF_HEIGHT > 86) {
      drawStave({
        page,
        x: margin,
        y,
        width,
        rand,
        boldFont: bold,
        italicFont: boldItalic,
        rehearsalMark: rand() < 0.3 ? marks[markIndex++ % marks.length] : undefined,
        dynamic: rand() < 0.45 ? dynamics[Math.floor(rand() * dynamics.length)] : undefined,
      })
      y -= STAFF_HEIGHT + 52
    }

    const footer = 'Tertnes Brass · demogenerert notesett (ikke ekte musikk)'
    page.drawText(footer, {
      x: (A4[0] - helv.widthOfTextAtSize(footer, 8)) / 2,
      y: 48,
      size: 8,
      font: helv,
      color: SOFT,
    })
    const pageNum = `${p + 1} av ${pages}`
    page.drawText(pageNum, {
      x: A4[0] - margin - helv.widthOfTextAtSize(pageNum, 8),
      y: 48,
      size: 8,
      font: helv,
      color: SOFT,
    })
  }

  return doc.save()
}

/**
 * Teller sider i en opplastet PDF med et lett byte-skann (teller
 * `/Type /Page`-objekter). Full parsing med pdf-lib ville vært mer presist,
 * men koster for mye CPU per request på Workers gratisplan. Returnerer null
 * om ingen sider gjenkjennes.
 */
export async function countPdfPages(bytes: ArrayBuffer): Promise<number | null> {
  try {
    const text = new TextDecoder('latin1').decode(new Uint8Array(bytes))
    const matches = text.match(/\/Type\s*\/Page[^s]/g)
    const count = matches?.length ?? 0
    return count > 0 ? count : null
  } catch {
    return null
  }
}
