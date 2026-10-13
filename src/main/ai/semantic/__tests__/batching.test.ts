import { describe, expect, it, vi } from 'vitest'
import {
  embedWithinLimit,
  estimateTokens,
  planEmbeddingBatches,
} from '../batching'

describe('estimateTokens', () => {
  it('counts prose words by letters and digits or symbols one by one', () => {
    expect(estimateTokens('abcd efgh')).toBe(2)
    expect(estimateTokens('2026-09-17T02:10')).toBe(16)
  })
  it('treats scripts without spaces as dense', () => {
    const text = '在服务器上部署应用程序'.repeat(10)
    expect(estimateTokens(text)).toBeGreaterThanOrEqual(
      Math.ceil(text.length * 0.7),
    )
  })
  it('treats hex and base64 runs as dense', () => {
    const hex
      = '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'
    const base64 = 'U29tZSBiYXNlNjQgZW5jb2RlZCBwYXlsb2FkIHdpdGggcGFkZGluZw=='
    expect(estimateTokens(hex)).toBeGreaterThanOrEqual(
      Math.ceil(hex.length * 0.7),
    )
    expect(estimateTokens(base64)).toBeGreaterThanOrEqual(
      Math.ceil(base64.length * 0.7),
    )
  })
})

describe('planEmbeddingBatches', () => {
  it('sorts by length and keeps padded batches within the token budget', () => {
    const texts = [
      'a'.repeat(7996),
      'b'.repeat(40),
      'c'.repeat(7996),
      'd'.repeat(400),
      'e'.repeat(7996),
    ]
    const batches = planEmbeddingBatches(texts, text => text, {
      tokens: 1999,
      items: 16,
    })
    expect(
      batches.map(batch => batch.map(text => text[0]).join('')),
    ).toEqual(['bd', 'a', 'c', 'e'])
    for (const batch of batches) {
      const longest = Math.max(...batch.map(estimateTokens))
      expect(batch.length === 1 || batch.length * longest <= 1999).toBe(true)
    }
  })
  it('caps the number of texts per batch', () => {
    const batches = planEmbeddingBatches(
      Array.from({ length: 40 }, () => 'short text'),
      text => text,
      { tokens: 2000, items: 16 },
    )
    expect(batches.map(batch => batch.length)).toEqual([16, 16, 8])
  })
})

describe('embedWithinLimit', () => {
  it('halves oversized batches recursively and keeps the original order', async () => {
    // «Токенов» в тексте столько, сколько в нём символов; паддинг до самого длинного.
    const prepare = vi.fn(async (texts: string[]) => ({
      inputs: texts,
      padded: texts.length * Math.max(...texts.map(text => text.length)),
    }))
    const embed = vi.fn(async (texts: string[]) =>
      texts.map(text => `v:${text}`),
    )
    const texts = ['aaaa', 'b', 'cc', 'dddddd', 'e']
    expect(await embedWithinLimit(texts, 8, prepare, embed)).toEqual(
      texts.map(text => `v:${text}`),
    )
    for (const [batch] of embed.mock.calls) {
      expect(
        batch.length === 1
        || batch.length * Math.max(...batch.map(text => text.length)) <= 8,
      ).toBe(true)
    }
  })
  it('embeds a single oversized text as is', async () => {
    const embed = vi.fn(async (texts: string[]) => texts.map(() => 1))
    await embedWithinLimit(
      ['x'.repeat(100)],
      8,
      async texts => ({ inputs: texts, padded: 100 }),
      embed,
    )
    expect(embed).toHaveBeenCalledTimes(1)
  })
})
