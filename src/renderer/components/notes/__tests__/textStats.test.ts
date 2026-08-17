import { describe, expect, it } from 'vitest'
import { getTextStats, shouldApplyTextStatsUpdate } from '../textStats'

describe('shouldApplyTextStatsUpdate', () => {
  it('rejects a stale A update after switching A to B and back to A', () => {
    expect(shouldApplyTextStatsUpdate(1, 3, 1, 1)).toBe(false)
  })

  it('accepts an update only for the current note revision', () => {
    expect(shouldApplyTextStatsUpdate(1, 3, 1, 3)).toBe(true)
    expect(shouldApplyTextStatsUpdate(2, 3, 1, 3)).toBe(false)
  })
})

describe('getTextStats', () => {
  it('returns zero stats for empty text', () => {
    expect(getTextStats('')).toEqual({
      symbols: 0,
      words: 0,
    })
  })

  it('counts symbols even when text has only whitespace', () => {
    expect(getTextStats(' \n\t ')).toEqual({
      symbols: 4,
      words: 0,
    })
  })

  it('counts words and symbols for plain latin text', () => {
    expect(getTextStats('Hello, world!')).toEqual({
      symbols: 13,
      words: 2,
    })
  })

  it('supports cyrillic and numbers in words counter', () => {
    expect(getTextStats('Привет\nмир 123')).toEqual({
      symbols: 14,
      words: 3,
    })
  })
})
