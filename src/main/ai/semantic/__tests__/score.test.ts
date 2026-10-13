import { describe, expect, it } from 'vitest'
import {
  combine,
  meaningGate,
  prepareVectors,
  rankChunks,
  SCORING,
  strongCount,
} from '../score'

function vectors(count: number) {
  // Шум вокруг общего компонента и одна запись, совпадающая с запросом.
  return Array.from({ length: count }, (_, index) => ({
    ref: `note:${index}`,
    n: 0,
    vector: [
      1,
      Math.sin(index * 1.7) * 0.1,
      Math.cos(index * 2.3) * 0.1,
      index === 3 ? 1 : 0,
    ],
  }))
}

describe('rankChunks', () => {
  it('finds the matching record by z of the raw cosine and keeps the best chunk per record', () => {
    const items = [
      ...vectors(40),
      { ref: 'note:3', n: 1, vector: [1, 0.1, 0, 0] },
    ]
    const hits = rankChunks([1, 0, 0, 1], prepareVectors(items))
    const best = [...hits].sort((a, b) => b[1].z - a[1].z)[0]
    expect(best[0]).toBe('note:3')
    expect(best[1].n).toBe(0)
    expect(best[1].similarity).toBeGreaterThan(0.8)
    expect(best[1].z).toBeGreaterThan(3)
  })
  it('keeps tail chunks out of the z statistics, falling back to all chunks', () => {
    const tail = Array.from({ length: 50 }, (_, n) => ({
      ref: 'note:99',
      n: n + 41,
      vector: [1, 0, 0, n % 2],
    }))
    expect(prepareVectors([...vectors(10), ...tail]).scaleSize).toBe(10)
    const hits = rankChunks([0, 0, 0, 1], prepareVectors(tail))
    expect(Number.isFinite(hits.get('note:99')!.z)).toBe(true)
  })
})

describe('meaningGate', () => {
  it('grows with the expected noise maximum of the index and keeps the floor on a small one', () => {
    expect(meaningGate(196)).toBeCloseTo(Math.sqrt(2 * Math.log(196)) + 0.25)
    expect(meaningGate(1500)).toBeGreaterThan(meaningGate(196))
    expect(meaningGate(10)).toBe(SCORING.zGate)
    expect(meaningGate(SCORING.smallIndex - 1)).toBe(SCORING.zGate)
    expect(meaningGate(SCORING.smallIndex)).toBeCloseTo(
      Math.sqrt(2 * Math.log(SCORING.smallIndex)) + SCORING.noiseMargin,
    )
  })
})

describe('combine', () => {
  const words = new Map([
    [
      'a',
      {
        coverage: 1,
        textCoverage: 1,
        bm25: 2,
        nameScore: 0,
        matchedTerms: ['x', 'y'],
        matchedStems: ['x', 'y'],
      },
    ],
    [
      'b',
      {
        coverage: 0.5,
        textCoverage: 0.5,
        bm25: 1,
        nameScore: 0,
        matchedTerms: ['x'],
        matchedStems: ['x'],
      },
    ],
    [
      'c',
      {
        coverage: 0,
        textCoverage: 0,
        bm25: 0,
        nameScore: 1,
        matchedTerms: [],
        matchedStems: [],
      },
    ],
  ])
  const hit = (z: number) => ({ z, similarity: 0.6, n: 0 })
  // Индекс из 196 чанков: шумовой порог около 3.5.
  const context = { lookup: false, scaleSize: 196 }
  it('changes only the folded tail when meaning stays below the noise gate', () => {
    const meaning = new Map([
      ['a', hit(3)],
      ['b', hit(3.2)],
      ['d', hit(3.3)],
      ['e', hit(2.4)],
      ['f', hit(1.5)],
    ])
    const full = combine(meaning, words, context)
    const wordsOnly = combine(new Map(), words, context)
    const visible = (results: typeof full) =>
      results
        .slice(0, strongCount(results))
        .map(result => [result.ref, result.score])
    expect(visible(full)).toEqual(visible(wordsOnly))
    expect(full.map(result => result.ref)).toEqual(['c', 'a', 'b', 'd', 'e'])
    expect(
      full
        .slice(-2)
        .every(
          result =>
            result.weak && !result.pinned && result.reason === 'meaning',
        ),
    ).toBe(true)
  })
  it('folds meaning-only records below the gate when none stands out', () => {
    const results = combine(
      new Map([
        ['d', hit(3.3)],
        ['e', hit(3.2)],
      ]),
      new Map(),
      context,
    )
    expect(results.map(result => result.ref)).toEqual(['d', 'e'])
    expect(strongCount(results)).toBe(0)
  })
  it('shows the best meaning hit when nothing is strong and it stands out from the next one', () => {
    // Порог около 3.5: 3.3 + (3.3 - 2.1) = 4.5 не ниже 3.5 + 0.25.
    const results = combine(
      new Map([
        ['d', hit(3.3)],
        ['e', hit(2.1)],
      ]),
      new Map(),
      context,
    )
    expect(
      results.map(result => [result.ref, result.weak, result.pinned]),
    ).toEqual([
      ['d', false, false],
      ['e', true, false],
    ])
    expect(strongCount(results)).toBe(1)
    // Если что-то сильное уже есть, слабые не поднимаются.
    const withWords = combine(
      new Map([
        ['d', hit(3.3)],
        ['e', hit(2.1)],
      ]),
      words,
      context,
    )
    expect(withWords.find(result => result.ref === 'd')?.weak).toBe(true)
  })
  it('measures the gap against the whole index and needs a second hit', () => {
    expect(
      combine(new Map([['d', hit(3.3)]]), new Map(), context)[0].weak,
    ).toBe(true)
    // Фильтр оставил одну запись, но рядом в индексе есть почти такой же хит: отрыва нет.
    const filtered = combine(
      new Map([
        ['d', hit(3.3)],
        ['e', hit(3.25)],
      ]),
      new Map(),
      { ...context, allow: ref => ref === 'd' },
    )
    expect(filtered.map(result => [result.ref, result.weak])).toEqual([
      ['d', true],
    ])
    const twoAllowed = combine(
      new Map([
        ['d', hit(3.3)],
        ['e', hit(2.1)],
        ['f', hit(3.25)],
      ]),
      new Map(),
      { ...context, allow: ref => ref !== 'f' },
    )
    expect(twoAllowed[0]).toMatchObject({ ref: 'd', weak: true })
  })
  it('keeps records with all words above a meaning-only hit unless that hit is far above noise', () => {
    const results = combine(new Map([['d', hit(4)]]), words, context)
    expect(results.map(result => [result.ref, result.reason])).toEqual([
      ['c', 'name'],
      ['a', 'words'],
      ['d', 'meaning'],
      ['b', 'words'],
    ])
    const far = combine(new Map([['d', hit(6)]]), words, context)
    expect(far[0]).toMatchObject({ ref: 'd', pinned: true })
  })
  it('does not pin a record whose words matched only through its folder', () => {
    const folderOnly = new Map([
      [
        'f',
        {
          coverage: 1,
          textCoverage: 0.5,
          bm25: 1,
          nameScore: 0,
          matchedTerms: ['x', 'y'],
          matchedStems: ['x', 'y'],
        },
      ],
    ])
    expect(combine(new Map(), folderOnly, context)[0]).toMatchObject({
      ref: 'f',
      pinned: false,
      reason: 'words',
    })
  })
  it('never folds pinned records', () => {
    const results = combine(new Map([['d', hit(9)]]), words, context)
    expect(results[0].ref).toBe('d')
    expect(strongCount(results)).toBe(3)
  })
  it('halves meaning and doubles words for lookups', () => {
    const results = combine(new Map([['b', hit(4)]]), words, {
      ...context,
      lookup: true,
    })
    expect(results.find(result => result.ref === 'b')?.score).toBeCloseTo(
      2 + 2 * 0.5 ** 1.5,
    )
  })
  it('falls back to stretched cosine on a small index', () => {
    const results = combine(
      new Map([['d', { z: 0, similarity: 0.65, n: 0 }]]),
      new Map(),
      { lookup: false, scaleSize: 5 },
    )
    expect(results[0].z).toBeCloseTo(3)
  })
  it('keeps only meaning close to the best one strong on a small index', () => {
    const sim = (similarity: number) => ({ z: 0, similarity, n: 0 })
    const results = combine(
      new Map([
        ['d', sim(0.84)],
        ['e', sim(0.81)],
        ['f', sim(0.7)],
        ['g', sim(0.55)],
      ]),
      new Map(),
      { lookup: false, scaleSize: 12 },
    )
    expect(results.map(result => [result.ref, result.weak])).toEqual([
      ['d', false],
      ['e', false],
      ['f', true],
    ])
    expect(strongCount(results)).toBe(2)
  })
  it('measures the best small-index match among allowed records only', () => {
    const sim = (similarity: number) => ({ z: 0, similarity, n: 0 })
    const results = combine(
      new Map([
        ['d', sim(0.84)],
        ['e', sim(0.7)],
      ]),
      new Map(),
      { lookup: false, scaleSize: 12, allow: ref => ref !== 'd' },
    )
    expect(results.map(result => [result.ref, result.weak])).toEqual([
      ['e', false],
    ])
  })
  it('filters before the limit', () => {
    const results = combine(
      new Map(),
      words,
      { ...context, allow: ref => ref !== 'c' },
      { ...SCORING, limit: 1 },
    )
    expect(results.map(result => result.ref)).toEqual(['a'])
  })
})

describe('strongCount', () => {
  it('folds unpinned results below half of the top score', () => {
    const results = [10, 6, 5, 4.9, 1].map((score, index) => ({
      ref: String(index),
      score,
      reason: 'words' as const,
      z: 0,
      coverage: 0,
      textCoverage: 0,
      nameScore: 0,
      pinned: false,
      weak: false,
    }))
    expect(strongCount(results)).toBe(3)
    expect(strongCount(results, { foldRatio: 0.7 })).toBe(1)
    expect(strongCount([])).toBe(0)
  })
})
