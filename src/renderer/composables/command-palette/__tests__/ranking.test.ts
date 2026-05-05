import { describe, expect, it } from 'vitest'
import {
  isCommandPaletteSearchMatch,
  rankCommandPaletteResults,
} from '../ranking'

const now = Date.UTC(2026, 4, 5)

describe('command palette ranking', () => {
  it('keeps exact title match above usage boost', () => {
    const ranked = rankCommandPaletteResults(
      [
        { id: 'popular', title: 'Command Pattern' },
        { id: 'exact', title: 'com' },
      ],
      {
        query: 'com',
        now,
        usageById: new Map([
          [
            'popular',
            {
              id: 'popular',
              openedAt: now,
              openCount: 100,
              lastQuery: 'com',
            },
          ],
        ]),
      },
    )

    expect(ranked.map(result => result.id)).toEqual(['exact', 'popular'])
  })

  it('uses frequency to sort similar text matches', () => {
    const ranked = rankCommandPaletteResults(
      [
        { id: 'first', title: 'Compose Helper' },
        { id: 'second', title: 'Command Pattern' },
      ],
      {
        query: 'com',
        now,
        usageById: new Map([
          [
            'second',
            {
              id: 'second',
              openedAt: now,
              openCount: 8,
            },
          ],
        ]),
      },
    )

    expect(ranked.map(result => result.id)).toEqual(['second', 'first'])
  })

  it('uses lastQuery to boost repeated query intent', () => {
    const ranked = rankCommandPaletteResults(
      [
        { id: 'first', title: 'Compose Helper' },
        { id: 'second', title: 'Command Helper' },
      ],
      {
        query: 'com',
        now,
        usageById: new Map([
          [
            'second',
            {
              id: 'second',
              openedAt: now - 3 * 24 * 60 * 60 * 1000,
              openCount: 1,
              lastQuery: 'com',
            },
          ],
        ]),
      },
    )

    expect(ranked.map(result => result.id)).toEqual(['second', 'first'])
  })

  it('keeps deterministic order for equal scores', () => {
    const ranked = rankCommandPaletteResults(
      [
        { id: 'first', title: 'Compose Helper' },
        { id: 'second', title: 'Command Pattern' },
      ],
      { query: 'com', now },
    )

    expect(ranked.map(result => result.id)).toEqual(['first', 'second'])
  })

  it('matches title, subtitle, keywords, and fuzzy title values', () => {
    expect(
      isCommandPaletteSearchMatch(
        { id: 'title', title: 'Compose Helper' },
        'compose',
      ),
    ).toBe(true)
    expect(
      isCommandPaletteSearchMatch(
        { id: 'subtitle', title: 'Helper', subtitle: 'Compose folder' },
        'compose',
      ),
    ).toBe(true)
    expect(
      isCommandPaletteSearchMatch(
        { id: 'keyword', title: 'New request', keywords: ['new-http-request'] },
        'http',
      ),
    ).toBe(true)
    expect(
      isCommandPaletteSearchMatch(
        { id: 'fuzzy', title: 'Command Pattern' },
        'cmp',
      ),
    ).toBe(true)
  })
})
