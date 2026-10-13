import { describe, expect, it } from 'vitest'
import {
  canRunOnEnter,
  getCreateFallbackTarget,
  getNextActiveIndex,
  getPreservedActiveIndex,
  resolveActiveSelection,
} from '../activeResult'

const list = (...ids: string[]) => ids.map(id => ({ id }))

describe('getPreservedActiveIndex', () => {
  it('follows the active result when items are inserted before it', () => {
    expect(
      getPreservedActiveIndex(list('a', 'cmd'), list('a', 'sem', 'cmd'), 1),
    ).toBe(2)
  })
  it('returns -1 when the active result is gone or unknown', () => {
    expect(getPreservedActiveIndex(list('a', 'b'), list('a'), 1)).toBe(-1)
    expect(getPreservedActiveIndex(undefined, list('a'), 0)).toBe(-1)
    expect(getPreservedActiveIndex(list('a'), list('a'), 5)).toBe(-1)
  })
})

describe('getNextActiveIndex', () => {
  const base = {
    keepOnce: false,
    sameInput: true,
    follow: true,
    previous: list('a', 'b', 'c'),
    next: list('c', 'a', 'b'),
    activeIndex: 1,
  }

  it('follows the active result by id', () => {
    expect(getNextActiveIndex(base)).toBe(2)
  })

  it('falls back to the first result when the active one is gone', () => {
    expect(getNextActiveIndex({ ...base, next: list('x', 'y', 'z') })).toBe(0)
  })

  it('starts from the top for a new input even if the record is still there', () => {
    expect(getNextActiveIndex({ ...base, sameInput: false })).toBe(0)
  })

  it('moves to the first result when following is not allowed', () => {
    expect(getNextActiveIndex({ ...base, follow: false })).toBe(0)
  })

  it('keeps the index once after expanding weak matches', () => {
    expect(
      getNextActiveIndex({
        ...base,
        keepOnce: true,
        previous: list('a', 'weak-matches'),
        next: list('a', 'w1', 'w2'),
      }),
    ).toBe(1)
  })

  it('returns 0 for an empty list', () => {
    expect(getNextActiveIndex({ ...base, next: [] })).toBe(0)
  })
})

describe('getCreateFallbackTarget', () => {
  it('returns the create target regardless of the query', () => {
    expect(getCreateFallbackTarget({ id: 'create-note-fallback:abc' })).toBe(
      'create-note-fallback',
    )
    expect(getCreateFallbackTarget({ id: 'note:1' })).toBeUndefined()
    expect(getCreateFallbackTarget(undefined)).toBeUndefined()
  })
})

describe('resolveActiveSelection', () => {
  const isCreateFallback = (result: { id: string } | undefined) =>
    !!getCreateFallbackTarget(result)
  const base = {
    results: list('a', 'b', 'c'),
    previous: list('a', 'b', 'c'),
    activeIndex: 1,
    isSearching: false,
    resultsKey: 'query',
    settledResultsKey: 'query' as string | undefined,
    hasManualSelection: true,
    keepOnce: false,
    isCreateFallback,
  }

  it('starts from the top for a new input even if the record is still there', () => {
    expect(
      resolveActiveSelection({
        ...base,
        resultsKey: 'query2',
        results: list('x', 'b'),
      }),
    ).toEqual({
      activeIndex: 0,
      settledResultsKey: 'query2',
      hasManualSelection: false,
    })
  })

  it('follows the record by id within the same input (words to full)', () => {
    expect(
      resolveActiveSelection({ ...base, results: list('a', 'sem', 'b', 'c') }),
    ).toEqual({
      activeIndex: 2,
      settledResultsKey: 'query',
      hasManualSelection: true,
    })
  })

  it('keeps the cursor on its record while searching with the old list', () => {
    expect(
      resolveActiveSelection({
        ...base,
        isSearching: true,
        resultsKey: 'query2',
        results: list('x', 'b'),
      }),
    ).toEqual({
      activeIndex: 1,
      settledResultsKey: undefined,
      hasManualSelection: false,
    })
    expect(
      resolveActiveSelection({
        ...base,
        isSearching: true,
        resultsKey: 'query2',
        settledResultsKey: undefined,
        activeIndex: 2,
        results: list('a', 'b', 'c'),
      }).activeIndex,
    ).toBe(2)
  })

  it('moves an auto-selected create fallback to the top when results arrive', () => {
    expect(
      resolveActiveSelection({
        ...base,
        hasManualSelection: false,
        previous: list('create-note-fallback:q'),
        activeIndex: 0,
        results: list('a', 'create-note-fallback:q'),
      }).activeIndex,
    ).toBe(0)
  })

  it('keeps the create fallback by target while searching regardless of manual selection', () => {
    expect(
      resolveActiveSelection({
        ...base,
        isSearching: true,
        resultsKey: 'qu',
        previous: list(
          'a',
          'create-snippet-fallback:q',
          'create-note-fallback:q',
        ),
        activeIndex: 2,
        results: list(
          'a',
          'b',
          'create-snippet-fallback:qu',
          'create-note-fallback:qu',
        ),
      }).activeIndex,
    ).toBe(3)
  })

  it('follows a manually selected create fallback by id in the same search', () => {
    expect(
      resolveActiveSelection({
        ...base,
        previous: list('a', 'create-note-fallback:q'),
        activeIndex: 1,
        results: list('a', 'b', 'create-note-fallback:q'),
      }).activeIndex,
    ).toBe(2)
  })

  it('resets manual selection while searching even with the settled key', () => {
    expect(
      resolveActiveSelection({ ...base, isSearching: true }).hasManualSelection,
    ).toBe(false)
  })

  it('falls back to the regular rules when the create target is gone while searching', () => {
    expect(
      resolveActiveSelection({
        ...base,
        isSearching: true,
        previous: list('a', 'create-note-fallback:q'),
        activeIndex: 1,
        results: list('a', 'b'),
      }).activeIndex,
    ).toBe(0)
  })

  it('prefers the create target over keepOnce while searching', () => {
    expect(
      resolveActiveSelection({
        ...base,
        isSearching: true,
        keepOnce: true,
        previous: list('a', 'create-note-fallback:q'),
        activeIndex: 1,
        results: list('a', 'b', 'create-note-fallback:qu'),
      }).activeIndex,
    ).toBe(2)
  })

  it('keeps the index once after expanding weak matches', () => {
    expect(
      resolveActiveSelection({
        ...base,
        keepOnce: true,
        previous: list('a', 'weak-matches'),
        results: list('a', 'w1', 'w2'),
      }).activeIndex,
    ).toBe(1)
  })
})

describe('canRunOnEnter', () => {
  const base = {
    result: { id: 'a' },
    isSearching: true,
    isLocal: false,
    isCreateFallback: false,
  }

  it('blocks non-local results while searching', () => {
    expect(canRunOnEnter(base)).toBe(false)
  })

  it('runs local commands while searching', () => {
    expect(canRunOnEnter({ ...base, isLocal: true })).toBe(true)
  })

  it('blocks create fallback while searching', () => {
    expect(
      canRunOnEnter({ ...base, isLocal: true, isCreateFallback: true }),
    ).toBe(false)
  })

  it('runs any result once searching is done', () => {
    expect(canRunOnEnter({ ...base, isSearching: false })).toBe(true)
    expect(
      canRunOnEnter({ ...base, isSearching: false, isCreateFallback: true }),
    ).toBe(true)
  })

  it('does nothing without a result', () => {
    expect(
      canRunOnEnter({ ...base, result: undefined, isSearching: false }),
    ).toBe(false)
  })
})
