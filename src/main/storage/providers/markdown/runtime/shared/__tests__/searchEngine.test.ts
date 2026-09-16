import { describe, expect, it } from 'vitest'
import {
  buildSearchIndex,
  invalidateSearchIndex,
  querySearchIndex,
  updateSearchIndexItem,
} from '../searchEngine'

interface TestItem {
  id: number
  text: string
}

const getSearchText = (item: TestItem) => item.text

describe('buildSearchIndex', () => {
  it('builds index with text and tokens', () => {
    const items = [
      { id: 1, text: 'Hello World' },
      { id: 2, text: 'Goodbye World' },
    ]
    const index = buildSearchIndex(items, getSearchText)

    expect(index.textById.size).toBe(2)
    expect(index.tokenToIds.size).toBeGreaterThan(0)
    expect(index.queryCache.size).toBe(0)
    expect(index.dirty).toBe(false)
  })

  it('normalizes text internally', () => {
    const items = [{ id: 1, text: 'Café Resume' }]
    const index = buildSearchIndex(items, getSearchText)

    expect(index.textById.get(1)).toBe('cafe resume')
  })
})

describe('querySearchIndex', () => {
  const items: TestItem[] = [
    { id: 1, text: 'MySigMail application' },
    { id: 2, text: 'Another project' },
    { id: 3, text: 'My notes about mail' },
  ]

  function buildIndex() {
    return buildSearchIndex(items, getSearchText)
  }

  it('returns all IDs for empty query', () => {
    const result = querySearchIndex(items, '', buildIndex(), getSearchText)
    expect(result).toEqual(new Set([1, 2, 3]))
  })

  it('finds by trigram match (3+ chars)', () => {
    const result = querySearchIndex(
      items,
      'mysig',
      buildIndex(),
      getSearchText,
    )
    expect(result).toEqual(new Set([1]))
  })

  it('finds by short query (1 char)', () => {
    const result = querySearchIndex(items, 'm', buildIndex(), getSearchText)
    expect(result).toEqual(new Set([1, 3]))
  })

  it('finds by short query (2 chars)', () => {
    const result = querySearchIndex(items, 'my', buildIndex(), getSearchText)
    expect(result).toEqual(new Set([1, 3]))
  })

  it('multi-word query matches full normalized substring', () => {
    // "my mail" as full substring doesn't appear in any item
    const result = querySearchIndex(
      items,
      'my mail',
      buildIndex(),
      getSearchText,
    )
    expect(result).toEqual(new Set())
  })

  it('single word query finds across items', () => {
    const result = querySearchIndex(items, 'mail', buildIndex(), getSearchText)
    expect(result).toEqual(new Set([1, 3]))
  })

  it('returns empty set when no match', () => {
    const result = querySearchIndex(
      items,
      'zzzzz',
      buildIndex(),
      getSearchText,
    )
    expect(result).toEqual(new Set())
  })

  it('falls back to linear scan when index is null', () => {
    const result = querySearchIndex(items, 'mysig', null, getSearchText)
    expect(result).toEqual(new Set([1]))
  })

  it('uses query cache on repeated calls', () => {
    const index = buildIndex()
    querySearchIndex(items, 'mysig', index, getSearchText)
    expect(index.queryCache.has('mysig')).toBe(true)

    const result = querySearchIndex(items, 'mysig', index, getSearchText)
    expect(result).toEqual(new Set([1]))
  })
})

describe('invalidateSearchIndex', () => {
  it('marks index as dirty and clears query cache', () => {
    const index = buildSearchIndex([{ id: 1, text: 'Hello' }], getSearchText)
    index.queryCache.set('hello', [1])

    invalidateSearchIndex(index)

    expect(index.dirty).toBe(true)
    expect(index.queryCache.size).toBe(0)
  })
})

describe('indexed and linear search parity', () => {
  const items: TestItem[] = [
    { id: 1, text: 'Café cafe CAFÉ résumé re\u0301sume\u0301' },
    { id: 2, text: 'Привет, мир! Привет, мир! Ελληνικά' },
    { id: 3, text: '你好世界 — 東京123' },
    { id: 4, text: 'a+b :: 🚀\nfoo_bar foo_bar' },
    { id: 5, text: `${'repeated '.repeat(1000)}tail` },
    { id: 6, text: '' },
  ]
  const queries: [string, number[]][] = [
    ['', [1, 2, 3, 4, 5, 6]],
    ['  ', [1, 2, 3, 4, 5, 6]],
    ['CAFÉ', [1]],
    ['re\u0301sume\u0301', [1]],
    ['ПРИВЕТ, МИР', [2]],
    ['Ελληνικά', [2]],
    ['世界', [3]],
    ['東京123', [3]],
    ['::', [4]],
    ['🚀', [4]],
    ['a+b', [4]],
    ['🚀\nfoo_bar', [4]],
    ['foo_', [4]],
    ['repeated repeated', [5]],
    ['e', [1, 5]],
    ['mi', []],
    ['not-present', []],
    ['cafe résumé', [1]],
  ]

  it.each(queries)(
    'matches linear scan for %j, including cached queries',
    (query, ids) => {
      const index = buildSearchIndex(items, getSearchText)
      const linear = querySearchIndex(items, query, null, getSearchText)
      expect(linear).toEqual(new Set(ids))
      expect(querySearchIndex(items, query, index, getSearchText)).toEqual(
        linear,
      )
      expect(querySearchIndex(items, query, index, getSearchText)).toEqual(
        linear,
      )
    },
  )

  it('preserves parity after edits, removals and additions rebuild the index', () => {
    const index = buildSearchIndex(items, getSearchText)
    for (const [query] of queries)
      querySearchIndex(items, query, index, getSearchText)

    const editedItems = [
      ...items.filter(item => item.id !== 1 && item.id !== 3),
      { id: 1, text: 'Updated updated 🚀 — новый текст' },
      { id: 7, text: 'Café 東京123' },
    ]
    invalidateSearchIndex(index)
    const rebuilt = buildSearchIndex(editedItems, getSearchText)
    for (const query of [
      ...queries.map(([query]) => query),
      'updated',
      'новый',
    ]) {
      expect(
        querySearchIndex(editedItems, query, rebuilt, getSearchText),
      ).toEqual(querySearchIndex(editedItems, query, null, getSearchText))
    }
    expect(
      querySearchIndex(editedItems, 'cafe', rebuilt, getSearchText),
    ).toEqual(new Set([7]))
    expect(
      querySearchIndex(editedItems, 'updated', rebuilt, getSearchText),
    ).toEqual(new Set([1]))
    expect(
      querySearchIndex(editedItems, '世界', rebuilt, getSearchText),
    ).toEqual(new Set())
  })
})

describe('updateSearchIndexItem', () => {
  it('replaces postings and clears positive and negative cached results', () => {
    const items = [
      { id: 1, text: 'oldtoken shared café' },
      { id: 2, text: 'shared untouched' },
    ]
    const index = buildSearchIndex(items, getSearchText)
    for (const query of ['oldtoken', 'newtoken', 'shared'])
      querySearchIndex(items, query, index, getSearchText)

    items[0].text = 'newtoken shared 東京'
    updateSearchIndexItem(index, 1, items[0].text)
    expect(index.dirty).toBe(false)
    expect(index.queryCache.size).toBe(0)
    expect(index.tokenToIds.has('g:old')).toBe(false)
    expect(index.tokenToIds.get('g:sha')).toEqual(new Set([1, 2]))
    for (const query of [
      'oldtoken',
      'newtoken',
      'shared',
      'cafe',
      '東京',
      'a',
      'untouched',
    ]) {
      expect(querySearchIndex(items, query, index, getSearchText)).toEqual(
        querySearchIndex(items, query, null, getSearchText),
      )
    }
  })

  it('leaves a dirty index untouched until its full rebuild', () => {
    const index = buildSearchIndex([{ id: 1, text: 'before' }], getSearchText)
    invalidateSearchIndex(index)
    const previousText = new Map(index.textById)
    const previousTokens = new Map(
      [...index.tokenToIds].map(([token, ids]) => [token, new Set(ids)]),
    )
    updateSearchIndexItem(index, 1, 'after')
    expect(index.dirty).toBe(true)
    expect(index.textById).toEqual(previousText)
    expect(index.tokenToIds).toEqual(previousTokens)
  })
})
