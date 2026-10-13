import { describe, expect, it } from 'vitest'
import {
  acceptsPaletteResponse,
  buildPaletteSearchPayload,
  getUsageTieBreak,
  mergeMeaningResults,
  shouldRunFullPhase,
  shouldShowContentEmpty,
  splitExcerpt,
  splitPaletteResults,
} from '../paletteSearch'

const item = (id: string, score: number) => ({ result: { id }, score })
const ids = (results: { id: string }[]) => results.map(result => result.id)

describe('buildPaletteSearchPayload', () => {
  it('searches all types without scope and drops filters', () => {
    expect(
      buildPaletteSearchPayload({
        query: '  docker  ',
        mode: 'words',
        tagFilter: { id: 1, spaceId: 'code' },
      }),
    ).toEqual({
      query: 'docker',
      types: ['snippet', 'note', 'http_request'],
      mode: 'words',
    })
  })

  it('passes filters of the scoped space only', () => {
    expect(
      buildPaletteSearchPayload({
        query: 'q',
        mode: 'full',
        scopeSpaceId: 'code',
        tagFilter: { id: 2, spaceId: 'code' },
        folderFilter: { id: 3, spaceId: 'notes' },
      }),
    ).toEqual({ query: 'q', types: ['snippet'], mode: 'full', tagId: 2 })
    expect(
      buildPaletteSearchPayload({
        query: 'q',
        mode: 'words',
        scopeSpaceId: 'http',
        tagFilter: { id: 2, spaceId: 'http' },
        folderFilter: { id: 4, spaceId: 'http' },
      }),
    ).toEqual({
      query: 'q',
      types: ['http_request'],
      mode: 'words',
      folderId: 4,
    })
  })

  it('returns null for an empty query or an unsearchable scope', () => {
    expect(buildPaletteSearchPayload({ query: ' ', mode: 'words' })).toBeNull()
    expect(
      buildPaletteSearchPayload({
        query: 'q',
        mode: 'words',
        scopeSpaceId: 'math',
      }),
    ).toBeNull()
  })
})

describe('search phases', () => {
  it('runs the meaning phase only when the index is ready', () => {
    expect(shouldRunFullPhase('ready', 'webhook')).toBe(true)
    expect(shouldRunFullPhase('warming', 'webhook')).toBe(false)
    expect(shouldRunFullPhase('off', 'webhook')).toBe(false)
  })

  it('skips the meaning phase for a too short query', () => {
    expect(shouldRunFullPhase('ready', 'w')).toBe(false)
    expect(shouldRunFullPhase('ready', ' a/b ')).toBe(false)
    expect(shouldRunFullPhase('ready', 'api')).toBe(true)
    expect(shouldRunFullPhase('ready', '登录')).toBe(true)
  })

  it('hides the empty state while the meaning phase is pending', () => {
    const empty = {
      settled: true,
      hasResults: false,
      hasLocalMatches: false,
      meaningPending: false,
    }
    expect(shouldShowContentEmpty(empty)).toBe(true)
    expect(shouldShowContentEmpty({ ...empty, meaningPending: true })).toBe(
      false,
    )
    expect(shouldShowContentEmpty({ ...empty, settled: false })).toBe(false)
    expect(shouldShowContentEmpty({ ...empty, hasResults: true })).toBe(false)
    expect(shouldShowContentEmpty({ ...empty, hasLocalMatches: true })).toBe(
      false,
    )
  })

  it('keeps an already shown empty state while meaning is pending', () => {
    const empty = {
      settled: true,
      hasResults: false,
      hasLocalMatches: false,
      meaningPending: true,
      shownBefore: true,
    }
    expect(shouldShowContentEmpty(empty)).toBe(true)
    expect(shouldShowContentEmpty({ ...empty, hasResults: true })).toBe(false)
  })

  it('drops responses of an older generation', () => {
    expect(
      acceptsPaletteResponse(2, undefined, { generation: 1, phase: 'words' }),
    ).toBe(false)
    expect(
      acceptsPaletteResponse(2, undefined, { generation: 1, phase: 'full' }),
    ).toBe(false)
    expect(
      acceptsPaletteResponse(2, undefined, { generation: 2, phase: 'words' }),
    ).toBe(true)
  })

  it('keeps the meaning list when a late words response arrives', () => {
    const applied = { generation: 3, phase: 'full' as const }
    expect(
      acceptsPaletteResponse(3, applied, { generation: 3, phase: 'words' }),
    ).toBe(false)
    expect(
      acceptsPaletteResponse(3, applied, { generation: 3, phase: 'full' }),
    ).toBe(true)
    expect(
      acceptsPaletteResponse(
        3,
        { generation: 3, phase: 'words' },
        { generation: 3, phase: 'full' },
      ),
    ).toBe(true)
  })
})

describe('splitPaletteResults', () => {
  it('caps the usage tie-break', () => {
    expect(getUsageTieBreak(0)).toBe(0)
    expect(getUsageTieBreak(4200)).toBeCloseTo(0.3)
    expect(getUsageTieBreak(99_999)).toBe(0.3)
  })

  it('reorders strong results by usage without crossing into weak', () => {
    const usage: Record<string, number> = { b: 4200, w: 4200 }
    const { strong, weak } = splitPaletteResults(
      [item('a', 1), item('b', 0.8), item('c', 0.4), item('w', 0.3)],
      3,
      id => usage[id] ?? 0,
    )
    expect(ids(strong)).toEqual(['b', 'a', 'c'])
    expect(ids(weak)).toEqual(['w'])
  })

  it('keeps main order when usage does not decide', () => {
    const { strong } = splitPaletteResults(
      [item('a', 1), item('b', 0.5), item('c', 0.5)],
      3,
      id => (id === 'b' ? 1000 : 0),
    )
    expect(ids(strong)).toEqual(['a', 'b', 'c'])
  })
})

describe('splitPaletteResults with fixed results', () => {
  it('keeps the fixed prefix and ranks the rest by usage', () => {
    const { strong, weak } = splitPaletteResults(
      [
        item('a', 0.1),
        item('b', 0.2),
        item('c', 0.7),
        item('d', 0.9),
        item('w', 0.1),
      ],
      4,
      id => (id === 'c' ? 4200 : 0),
      2,
    )
    expect(ids(strong)).toEqual(['a', 'b', 'c', 'd'])
    expect(ids(weak)).toEqual(['w'])
  })
})

describe('mergeMeaningResults', () => {
  const merge = (
    wordsStrong: string[],
    full: string[],
    fullStrongCount: number,
  ) =>
    mergeMeaningResults({
      wordsStrong: wordsStrong.map(key => ({ key, from: 'words' })),
      full: full.map(key => ({ key, from: 'full' })),
      fullStrongCount,
      getKey: entry => entry.key,
    })

  it('applies full as is without strong words results', () => {
    const merged = merge([], ['x', 'y', 'z'], 1)
    expect(merged.items.map(entry => entry.key)).toEqual(['x', 'y', 'z'])
    expect(merged.strongCount).toBe(1)
    expect(merged.fixedCount).toBe(0)
  })

  it('keeps words order on top, then new strong, then weak of full', () => {
    const merged = merge(['b', 'a'], ['c', 'a', 'd', 'b', 'e'], 3)
    expect(merged.items.map(entry => entry.key)).toEqual([
      'b',
      'a',
      'c',
      'd',
      'e',
    ])
    expect(merged.strongCount).toBe(4)
    expect(merged.fixedCount).toBe(2)
  })

  it('takes the full version of a words result and keeps one missing in full', () => {
    const merged = merge(['a', 'gone'], ['a', 'x'], 1)
    expect(merged.items).toEqual([
      { key: 'a', from: 'full' },
      { key: 'gone', from: 'words' },
      { key: 'x', from: 'full' },
    ])
    expect(merged.strongCount).toBe(2)
  })
})

describe('splitExcerpt', () => {
  it('splits text into matched and plain segments', () => {
    expect(
      splitExcerpt('run docker compose up', [
        [4, 10],
        [11, 18],
      ]),
    ).toEqual([
      { text: 'run ', match: false },
      { text: 'docker', match: true },
      { text: ' ', match: false },
      { text: 'compose', match: true },
      { text: ' up', match: false },
    ])
  })

  it('clamps, sorts and merges overlapping ranges', () => {
    expect(
      splitExcerpt('abcdef', [
        [4, 99],
        [1, 3],
        [2, 4],
        [-5, 0],
      ]),
    ).toEqual([
      { text: 'a', match: false },
      { text: 'bc', match: true },
      { text: 'd', match: true },
      { text: 'ef', match: true },
    ])
  })

  it('returns the whole text without ranges', () => {
    expect(splitExcerpt('plain', [])).toEqual([
      { text: 'plain', match: false },
    ])
  })
})
