import { describe, expect, it } from 'vitest'
import { type AccessCtx, memberCanAccessFile, memberCanSeeFile, shareAllows } from './file-access'

const file = (kind: string, partId: string | null = null) => ({ kind, partId })

// Vanlig medlem med Slagverk 1, kan se partitur, ikke fullt arkivinnsyn.
const member: AccessCtx = {
  effectivePartIds: ['percussion-1'],
  canViewScore: true,
  canViewAll: false,
  inAccessibleProject: true,
}
// Stab/dirigent: fullt arkivinnsyn.
const viewAll: AccessCtx = {
  effectivePartIds: [],
  canViewScore: true,
  canViewAll: true,
  inAccessibleProject: false,
}
// Medlem uten partitur-rett.
const noScore: AccessCtx = {
  effectivePartIds: ['percussion-1'],
  canViewScore: false,
  canViewAll: false,
  inAccessibleProject: true,
}
const outsideProject: AccessCtx = { ...member, inAccessibleProject: false }

describe('memberCanAccessFile (nedlasting)', () => {
  it('egen stemme: ja', () => {
    expect(memberCanAccessFile(file('part', 'percussion-1'), member)).toBe(true)
  })
  it('andres stemme: nei', () => {
    expect(memberCanAccessFile(file('part', 'solo-cornet'), member)).toBe(false)
  })
  it('partitur følger scores.view', () => {
    expect(memberCanAccessFile(file('score'), member)).toBe(true)
    expect(memberCanAccessFile(file('score'), noScore)).toBe(false)
  })
  it('lyd alltid åpen for innlogget', () => {
    expect(memberCanAccessFile(file('audio'), member)).toBe(true)
    expect(memberCanAccessFile(file('audio'), noScore)).toBe(true)
  })
  it('uplassert (other) kun med fullt arkivinnsyn', () => {
    expect(memberCanAccessFile(file('other'), member)).toBe(false)
    expect(memberCanAccessFile(file('other'), viewAll)).toBe(true)
  })
  it('fullt arkivinnsyn når andres stemme og uplassert', () => {
    expect(memberCanAccessFile(file('part', 'solo-cornet'), viewAll)).toBe(true)
  })
  it('avviser alle filer utenfor publiserte, kommende prosjekter', () => {
    expect(memberCanAccessFile(file('part', 'percussion-1'), outsideProject)).toBe(false)
    expect(memberCanAccessFile(file('score'), outsideProject)).toBe(false)
    expect(memberCanAccessFile(file('audio'), outsideProject)).toBe(false)
  })
  it('medlem uten stemme når ingen part-filer', () => {
    const none: AccessCtx = { ...member, effectivePartIds: [] }
    expect(memberCanAccessFile(file('part', 'percussion-1'), none)).toBe(false)
  })
})

describe('shareAllows (vikar)', () => {
  const shared = ['percussion-1', 'percussion-2']
  it('delt stemme: ja, udelt: nei', () => {
    expect(shareAllows(file('part', 'percussion-1'), shared)).toBe(true)
    expect(shareAllows(file('part', 'solo-cornet'), shared)).toBe(false)
  })
  it('lyd alltid med', () => {
    expect(shareAllows(file('audio'), shared)).toBe(true)
    expect(shareAllows(file('audio'), [])).toBe(true)
  })
  it('partitur og uplassert aldri via vikarlenke', () => {
    expect(shareAllows(file('score'), shared)).toBe(false)
    expect(shareAllows(file('other'), shared)).toBe(false)
  })
})

describe('memberCanSeeFile (metadata i liste)', () => {
  it('partitur/lyd vises alltid (nedlasting gates separat)', () => {
    expect(memberCanSeeFile(file('score'), noScore)).toBe(true)
    expect(memberCanSeeFile(file('audio'), member)).toBe(true)
  })
  it('egen stemme vises, andres skjules', () => {
    expect(memberCanSeeFile(file('part', 'percussion-1'), member)).toBe(true)
    expect(memberCanSeeFile(file('part', 'solo-cornet'), member)).toBe(false)
  })
  it('uplassert skjules for ikke-arkivinnsyn, vises ellers', () => {
    expect(memberCanSeeFile(file('other'), member)).toBe(false)
    expect(memberCanSeeFile(file('other'), viewAll)).toBe(true)
  })
  it('skjuler alle filmetadata utenfor tilgjengelige prosjekter', () => {
    expect(memberCanSeeFile(file('part', 'percussion-1'), outsideProject)).toBe(false)
    expect(memberCanSeeFile(file('score'), outsideProject)).toBe(false)
    expect(memberCanSeeFile(file('audio'), outsideProject)).toBe(false)
  })
})
