import { describe, expect, it } from 'vitest'
import { getContentSearchMatches } from '../contentSearch'

describe('getContentSearchMatches', () => {
  it('finds case-insensitive non-overlapping matches', () => {
    expect(getContentSearchMatches('Note note NOTE', 'note')).toEqual([
      { from: 0, to: 4 },
      { from: 5, to: 9 },
      { from: 10, to: 14 },
    ])
  })

  it('returns no matches for an empty query', () => {
    expect(getContentSearchMatches('content', '')).toEqual([])
  })

  it('supports multiline queries', () => {
    expect(getContentSearchMatches('first\nsecond\nfirst', 'd\nf')).toEqual([
      { from: 11, to: 14 },
    ])
  })

  it('preserves UTF-16 offsets when Unicode case folding changes length', () => {
    expect(getContentSearchMatches('AİB', 'B')).toEqual([{ from: 2, to: 3 }])
  })

  it('treats regular expression characters literally', () => {
    expect(getContentSearchMatches('a.b a+b [x]', 'a.b')).toEqual([
      { from: 0, to: 3 },
    ])
    expect(getContentSearchMatches('a.b a+b [x]', '[x]')).toEqual([
      { from: 8, to: 11 },
    ])
  })
})
