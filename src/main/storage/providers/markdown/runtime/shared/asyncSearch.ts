import type { SearchIndex } from './searchEngine'
import { setImmediate } from 'node:timers/promises'
import { buildSearchIndex, updateSearchIndexItem } from './searchEngine'

// A single guarded file read or GC can exceed this budget. Yield between
// documents, never while a document or the published index is half updated.
const SEARCH_CHUNK_MS = 8

async function runSearchChunks<T>(
  items: T[],
  visit: (item: T) => void,
  isCurrent: () => boolean,
): Promise<boolean> {
  let started = performance.now()
  for (let index = 0; index < items.length; index++) {
    visit(items[index])
    if (
      index + 1 < items.length
      && performance.now() - started >= SEARCH_CHUNK_MS
    ) {
      await setImmediate()
      if (!isCurrent())
        return false
      started = performance.now()
    }
  }
  return isCurrent()
}

export function createAsyncSearchPreparation<
  T extends { id: number },
  C extends { searchIndex: SearchIndex, state: object },
>(
  getItems: (cache: C) => T[],
  hydrate: (cache: C, item: T) => void,
  getSearchText: (item: T) => string,
) {
  const inFlight = new WeakMap<C, Promise<boolean>>()

  async function prepare(cache: C, getCache: () => C): Promise<boolean> {
    const source = cache.searchIndex
    const state = cache.state
    const items = getItems(cache)
    let revision = source.revision
    const isCurrent = () =>
      getCache() === cache
      && cache.state === state
      && getItems(cache) === items
      && cache.searchIndex === source
      && source.revision === revision

    if (
      !(await runSearchChunks(
        items,
        (item) => {
          hydrate(cache, item)
          // Hydration invalidates the source synchronously. Accept only these
          // own changes; mutations while yielded are checked before continuing.
          revision = source.revision
        },
        isCurrent,
      ))
    ) {
      return false
    }

    if (!isCurrent())
      return false
    if (!source.dirty)
      return true
    const candidate = buildSearchIndex<T>([], getSearchText)
    if (
      !(await runSearchChunks(
        items,
        (item) => {
          updateSearchIndexItem(candidate, item.id, getSearchText(item))
        },
        isCurrent,
      ))
    ) {
      return false
    }
    if (!isCurrent())
      return false
    cache.searchIndex = candidate
    return true
  }

  return async (getCache: () => C) => {
    while (true) {
      const cache = getCache()
      let job = inFlight.get(cache)
      if (!job) {
        job = prepare(cache, getCache)
        inFlight.set(cache, job)
      }
      let complete: boolean
      try {
        complete = await job
      }
      finally {
        if (inFlight.get(cache) === job)
          inFlight.delete(cache)
      }
      // A yielded preparation may have been superseded, or another waiter
      // may have edited the data before this continuation resumed.
      if (!complete || getCache() !== cache || cache.searchIndex.dirty)
        continue
      const index = cache.searchIndex
      const revision = index.revision
      const items = getItems(cache)
      const state = cache.state
      return {
        cache,
        index,
        items,
        isCurrent: () =>
          getCache() === cache
          && cache.state === state
          && cache.searchIndex === index
          && index.revision === revision
          && getItems(cache) === items,
      }
    }
  }
}
