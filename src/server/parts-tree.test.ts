import { describe, expect, it } from 'vitest'
import { type PartNode, buildChildrenMap, expandPartIds, leaderCanAssign } from './parts-tree'

const sorted = (xs: string[]) => [...xs].sort()

describe('expandPartIds / buildChildrenMap', () => {
  it('flat besetning (alle parentId = null) → identitet (dagens oppførsel)', () => {
    const flat: PartNode[] = [
      { id: 'solo-cornet', parentId: null },
      { id: 'percussion-1', parentId: null },
    ]
    const cm = buildChildrenMap(flat)
    expect(expandPartIds(['solo-cornet'], cm)).toEqual(['solo-cornet'])
    expect(expandPartIds(['percussion-1'], cm)).toEqual(['percussion-1'])
  })

  it('forelder ekspanderer til alle barn', () => {
    const tree: PartNode[] = [
      { id: 'percussion', parentId: null },
      { id: 'percussion-1', parentId: 'percussion' },
      { id: 'percussion-2', parentId: 'percussion' },
      { id: 'percussion-3', parentId: 'percussion' },
      { id: 'solo-cornet', parentId: null },
    ]
    const cm = buildChildrenMap(tree)
    expect(sorted(expandPartIds(['percussion'], cm))).toEqual(
      sorted(['percussion', 'percussion-1', 'percussion-2', 'percussion-3']),
    )
  })

  it('blad ekspanderer kun til seg selv', () => {
    const tree: PartNode[] = [
      { id: 'percussion', parentId: null },
      { id: 'percussion-1', parentId: 'percussion' },
      { id: 'percussion-2', parentId: 'percussion' },
    ]
    const cm = buildChildrenMap(tree)
    expect(expandPartIds(['percussion-1'], cm)).toEqual(['percussion-1'])
  })

  it('multi-stemme på tvers av to seksjoner → union av begge subtrær', () => {
    const tree: PartNode[] = [
      { id: 'percussion', parentId: null },
      { id: 'percussion-1', parentId: 'percussion' },
      { id: 'cornets', parentId: null },
      { id: 'solo-cornet', parentId: 'cornets' },
      { id: 'second-cornet', parentId: 'cornets' },
    ]
    const cm = buildChildrenMap(tree)
    expect(sorted(expandPartIds(['percussion', 'solo-cornet'], cm))).toEqual(
      sorted(['percussion', 'percussion-1', 'solo-cornet']),
    )
  })

  it('konstruert sykel (A→B→A) terminerer og kaster ikke', () => {
    const cyclic: PartNode[] = [
      { id: 'a', parentId: 'b' },
      { id: 'b', parentId: 'a' },
    ]
    const cm = buildChildrenMap(cyclic)
    expect(sorted(expandPartIds(['a'], cm))).toEqual(['a', 'b'])
  })

  it('dybde over grensen kuttes (terminerer på patologisk dyp kjede)', () => {
    // a→b→c→d→e (dybde 0..4). MAX_PART_DEPTH = 3 ⇒ e faller utenfor.
    const deep: PartNode[] = [
      { id: 'a', parentId: null },
      { id: 'b', parentId: 'a' },
      { id: 'c', parentId: 'b' },
      { id: 'd', parentId: 'c' },
      { id: 'e', parentId: 'd' },
    ]
    const cm = buildChildrenMap(deep)
    const out = expandPartIds(['a'], cm)
    expect(out).toContain('d')
    expect(out).not.toContain('e')
  })

  it('partitur (score) er aldri del av treet', () => {
    const tree: PartNode[] = [
      { id: 'score', parentId: null },
      { id: 'percussion', parentId: null },
      { id: 'percussion-1', parentId: 'score' }, // feilkonfig: forsøk på å henge under score
    ]
    const cm = buildChildrenMap(tree)
    expect(expandPartIds(['score'], cm)).toEqual([])
    // percussion-1 med parentId='score' skal ikke dukke opp via score
    expect(buildChildrenMap(tree).has('score')).toBe(false)
  })

  it('tomt input → tomt output', () => {
    expect(expandPartIds([], new Map())).toEqual([])
  })

  describe('leaderCanAssign', () => {
    const scope = ['percussion-1', 'percussion-2', 'percussion-3'] // ekspandert omfang

    it('tillater når nåværende OG innsendte er innenfor omfanget', () => {
      expect(leaderCanAssign(scope, ['percussion-1'], ['percussion-2', 'percussion-3'])).toBe(true)
    })

    it('avviser innsendt stemme utenfor omfanget (smugling i blandet liste)', () => {
      expect(leaderCanAssign(scope, ['percussion-1'], ['percussion-1', 'solo-cornet'])).toBe(false)
    })

    it('avviser medlem som har en stemme utenfor omfanget (kapring)', () => {
      expect(leaderCanAssign(scope, ['percussion-1', 'solo-cornet'], ['percussion-2'])).toBe(false)
    })

    it('avviser stemmeløst medlem (kun global members.manage)', () => {
      expect(leaderCanAssign(scope, [], ['percussion-1'])).toBe(false)
    })

    it('avviser leder uten omfang', () => {
      expect(leaderCanAssign([], ['percussion-1'], ['percussion-1'])).toBe(false)
    })

    it('tillater å tømme stemmer for medlem i egen seksjon', () => {
      expect(leaderCanAssign(scope, ['percussion-1'], [])).toBe(true)
    })
  })

  it('dupliserte input-ider (forelder + barn samtidig) dedupliseres', () => {
    const tree: PartNode[] = [
      { id: 'percussion', parentId: null },
      { id: 'percussion-1', parentId: 'percussion' },
    ]
    const cm = buildChildrenMap(tree)
    expect(sorted(expandPartIds(['percussion', 'percussion-1'], cm))).toEqual(
      sorted(['percussion', 'percussion-1']),
    )
  })
})
