import { describe, expect, it } from 'vitest'
import { formatMathDate, formatMathNumber } from '../format'

describe('formatMathNumber', () => {
  it('formats integer with en-US locale', () => {
    expect(formatMathNumber(1234, 'en-US', 6)).toBe('1,234')
  })

  it('formats integer with de-DE locale', () => {
    expect(formatMathNumber(1234, 'de-DE', 6)).toBe('1.234')
  })

  it('formats integer with ru-RU locale', () => {
    const result = formatMathNumber(1234, 'ru-RU', 6)
    // ru-RU uses narrow no-break space (U+202F) as thousands separator
    expect(result.replace(/\s/g, ' ')).toBe('1 234')
  })

  it('formats decimal with en-US locale and 6 decimal places', () => {
    expect(formatMathNumber(1 / 3, 'en-US', 6)).toBe('0.333333')
  })

  it('formats decimal with de-DE locale and 6 decimal places', () => {
    expect(formatMathNumber(1 / 3, 'de-DE', 6)).toBe('0,333333')
  })

  it('formats decimal with 2 decimal places', () => {
    expect(formatMathNumber(1 / 3, 'en-US', 2)).toBe('0.33')
  })

  it('formats decimal with 0 decimal places', () => {
    expect(formatMathNumber(1 / 3, 'en-US', 0)).toBe('0')
  })

  it('formats decimal with 14 decimal places', () => {
    const result = formatMathNumber(1 / 3, 'en-US', 14)
    expect(result).toBe('0.33333333333333')
  })

  it('trims trailing zeros', () => {
    expect(formatMathNumber(2, 'en-US', 6)).toBe('2')
  })

  it('formats large number with thousands separator', () => {
    const result = formatMathNumber(1234567.89, 'fr-FR', 6)
    // fr-FR uses narrow no-break space as thousands separator and comma as decimal
    expect(result.replace(/\s/g, ' ')).toBe('1 234 567,89')
  })
})

describe('formatMathDate', () => {
  const date = new Date(2026, 2, 28) // March 28, 2026

  it('formats date with en-US locale', () => {
    expect(formatMathDate(date, 'en-US')).toBe('3/28/2026, 12:00:00 AM')
  })

  it('formats date with de-DE locale', () => {
    expect(formatMathDate(date, 'de-DE')).toBe('28.3.2026, 0:00:00')
  })

  it('formats date with ru-RU locale', () => {
    expect(formatMathDate(date, 'ru-RU')).toBe('28.03.2026, 0:00:00')
  })
})
