import { describe, expect, it } from 'vitest'
import {
  buildSearchIndex,
  invalidateSearchIndex,
  querySearchIndex,
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
