import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EntityCache } from '../cache'

describe('entityCache', () => {
  let cache: EntityCache

  beforeEach(() => {
    vi.useFakeTimers()
    cache = new EntityCache(5_000)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns undefined for unknown keys', () => {
    expect(cache.get('snippet:1')).toBeUndefined()
  })

  it('stores and retrieves entity entries', () => {
    const entity = {
      exists: true as const,
      data: {
        id: 1,
        name: 'Test',
        type: 'snippet' as const,
        folder: null,
        isDeleted: 0,
        firstContent: null,
      },
    }

    cache.set('snippet:1', entity)

    expect(cache.get('snippet:1')).toEqual(entity)
  })

  it('stores broken-link entries', () => {
    cache.set('snippet:99', { exists: false })

    expect(cache.get('snippet:99')).toEqual({ exists: false })
  })

  it('expires entries after ttl', () => {
    cache.set('snippet:1', {
      exists: true,
      data: {
        id: 1,
        name: 'Test',
        type: 'snippet',
        folder: null,
        isDeleted: 0,
      },
    })

    vi.advanceTimersByTime(5_001)

    expect(cache.get('snippet:1')).toBeUndefined()
  })

  it('tracks pending keys for request dedupe', () => {
    expect(cache.isPending('snippet:1')).toBe(false)

    cache.markPending('snippet:1')

    expect(cache.isPending('snippet:1')).toBe(true)

    cache.set('snippet:1', {
      exists: true,
      data: {
        id: 1,
        name: 'Test',
        type: 'snippet',
        folder: null,
        isDeleted: 0,
      },
    })

    expect(cache.isPending('snippet:1')).toBe(false)
  })

  it('clears all entries', () => {
    cache.set('snippet:1', {
      exists: true,
      data: {
        id: 1,
        name: 'Test',
        type: 'snippet',
        folder: null,
        isDeleted: 0,
      },
    })

    cache.markPending('note:2')
    cache.clear()

    expect(cache.get('snippet:1')).toBeUndefined()
    expect(cache.isPending('note:2')).toBe(false)
  })
})
