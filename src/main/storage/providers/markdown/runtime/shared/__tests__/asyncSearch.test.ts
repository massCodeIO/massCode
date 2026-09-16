import { setImmediate } from 'node:timers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAsyncSearchPreparation } from '../asyncSearch'
import {
  buildSearchIndex,
  invalidateSearchIndex,
  querySearchIndex,
  updateSearchIndexItem,
} from '../searchEngine'

interface Item {
  id: number
  text: string | null
}
const text = (item: Item) => item.text || ''
function cacheFor(items: Item[]) {
  const searchIndex = buildSearchIndex(items, text)
  invalidateSearchIndex(searchIndex)
  return { items, state: {}, searchIndex }
}
type Cache = ReturnType<typeof cacheFor>
function forceChunks() {
  let time = 0
  vi.spyOn(performance, 'now').mockImplementation(() => (time += 9))
}
afterEach(() => vi.restoreAllMocks())

describe('asynchronous search preparation', () => {
  it('yields to the event loop, coalesces requests and accepts its own hydration', async () => {
    forceChunks()
    const cache = cacheFor([
      { id: 1, text: null },
      { id: 2, text: null },
      { id: 3, text: null },
    ])
    const hydrate = vi.fn((current: Cache, item: Item) => {
      if (item.text === null) {
        item.text = `body${item.id}`
        invalidateSearchIndex(current.searchIndex)
      }
    })
    const prepare = createAsyncSearchPreparation(
      (current: Cache) => current.items,
      hydrate,
      text,
    )
    let yielded = false
    setImmediate(() => {
      yielded = true
    })
    const [first, second] = await Promise.all([
      prepare(() => cache),
      prepare(() => cache),
    ])
    expect(yielded).toBe(true)
    expect(first.index).toBe(second.index)
    expect(first.isCurrent()).toBe(true)
    expect(hydrate).toHaveBeenCalledTimes(3)
    expect(querySearchIndex(cache.items, 'body2', first.index, text)).toEqual(
      new Set([2]),
    )
  })

  it.each(['body', 'rename', 'delete', 'cache', 'index', 'array'] as const)(
    'discards a partial candidate after %s changes during a real yield',
    async (mutation) => {
      forceChunks()
      let current = cacheFor([
        { id: 1, text: 'oldword' },
        { id: 2, text: 'stable' },
        { id: 3, text: 'tail' },
      ])
      const original = current
      let scheduled = false
      const getText = (item: Item) => {
        if (!scheduled) {
          scheduled = true
          setImmediate(() => {
            if (mutation === 'cache') {
              current = cacheFor([{ id: 10, text: 'newword' }])
            }
            else if (mutation === 'delete') {
              current.items.splice(0, 1)
              invalidateSearchIndex(current.searchIndex)
            }
            else if (mutation === 'array') {
              current.items = [{ id: 10, text: 'newword' }]
              invalidateSearchIndex(current.searchIndex)
            }
            else {
              current.items[0].text = 'newword'
              if (mutation === 'body')
                updateSearchIndexItem(current.searchIndex, 1, 'newword')
              else if (mutation === 'index')
                current.searchIndex = buildSearchIndex(current.items, text)
              else invalidateSearchIndex(current.searchIndex)
            }
          })
        }
        return text(item)
      }
      const prepare = createAsyncSearchPreparation(
        (cache: Cache) => cache.items,
        () => {},
        getText,
      )
      const prepared = await prepare(() => current)
      expect(prepared.cache).toBe(current)
      expect(prepared.isCurrent()).toBe(true)
      expect(current.searchIndex.dirty).toBe(false)
      for (const query of ['oldword', 'newword', 'stable', 'tail']) {
        expect(
          querySearchIndex(current.items, query, prepared.index, text),
        ).toEqual(querySearchIndex(current.items, query, null, text))
      }
      if (mutation === 'cache')
        expect(original.searchIndex.dirty).toBe(true)
    },
  )

  it('retries hydration if a clean metadata index is edited while yielded', async () => {
    forceChunks()
    const cache = cacheFor([
      { id: 1, text: null },
      { id: 2, text: null },
    ])
    cache.searchIndex = buildSearchIndex(cache.items, text)
    let scheduled = false
    const hydrate = (current: Cache, item: Item) => {
      if (!scheduled) {
        scheduled = true
        setImmediate(() => {
          current.items[0].text = 'newword'
          updateSearchIndexItem(current.searchIndex, 1, 'newword')
        })
      }
      if (item.id === 2 && item.text === null) {
        item.text = 'latebody'
        invalidateSearchIndex(current.searchIndex)
      }
    }
    const prepare = createAsyncSearchPreparation(
      (current: Cache) => current.items,
      hydrate,
      text,
    )
    const prepared = await prepare(() => cache)
    expect(
      querySearchIndex(cache.items, 'latebody', prepared.index, text),
    ).toEqual(new Set([2]))
    expect(
      querySearchIndex(cache.items, 'newword', prepared.index, text),
    ).toEqual(new Set([1]))
  })
})
