import { describe, expect, it } from 'vitest'
import { getTextStats } from '../textStats'

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
