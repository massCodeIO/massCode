import { describe, expect, it } from 'vitest'
import { buildSearchTokens, normalizeSearchValue } from '../searchIndex'

// Reference the original whole-text tokenization: line deduplication must
// preserve exactly the same candidate keys, not merely the final matches.
function referenceTokens(parts: string[]): Set<string> {
  const tokens = new Set<string>()
  for (const word of parts.join(' ').match(/[\p{L}\p{N}_]+/gu) || []) {
    for (let offset = 0; offset + 3 <= word.length; offset++)
      tokens.add(`g:${word.slice(offset, offset + 3)}`)
  }
  return tokens
}

describe('search token line deduplication', () => {
  it('keeps line and part boundaries while deduplicating repeated lines', () => {
    expect(buildSearchTokens(['ab\ncd\r\nef', 'abc\nabc', 'def'])).toEqual(
      new Set(['g:abc', 'g:def']),
    )
    expect(buildSearchTokens('abc\nabc\ndef')).toEqual(
      new Set(['g:abc', 'g:def']),
    )
  })

  it('matches whole-text tokenization for Unicode, empty and large lines', () => {
    const parts = [
      '',
      'Café Поиск 東京１２３ 𐐀𐐁𐐂 😀 x_y_123',
      'ΟΣ ΟΣΑ café\r\n\r\nabc\nabc\n',
      'a'.repeat(131072),
      'const value = 12;\n'.repeat(2000),
    ].map(normalizeSearchValue)
    expect(buildSearchTokens(parts)).toEqual(referenceTokens(parts))
    expect(buildSearchTokens(parts.join('\n'))).toEqual(referenceTokens(parts))
  })

  it('matches the reference for deterministic mixtures of separators and repeated lines', () => {
    let seed = 23
    const pick = (count: number) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed % count
    }
    const pieces = [
      'abc',
      'ab',
      'a',
      '',
      '東京１２３',
      '𐐀𐐁𐐂',
      'Café',
      'Поиск',
      '😀',
      '_foo_12',
      '\r',
      '\t',
      '\u2028',
    ]
    for (let sample = 0; sample < 200; sample++) {
      const lines = Array.from({ length: 12 }, () =>
        Array.from({ length: 8 }, () => pieces[pick(pieces.length)]).join(' '))
      const parts = Array.from({ length: 3 }, () =>
        Array.from({ length: 20 }, () => lines[pick(lines.length)]).join('\n')).map(normalizeSearchValue)
      expect(buildSearchTokens(parts)).toEqual(referenceTokens(parts))
    }
  })
})
