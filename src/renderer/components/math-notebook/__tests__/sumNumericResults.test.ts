import type { LineResult } from '@/composables/math-notebook'
import { describe, expect, it } from 'vitest'
import { sumNumericResults } from '../sumNumericResults'

describe('sumNumericResults', () => {
  it('sums numericValue and ignores other result types', () => {
    const results: LineResult[] = [
      { value: '10', error: null, type: 'number', numericValue: 10 },
      { value: '12.03.2025, 0:00:00', error: null, type: 'assignment' },
      { value: '100 USD', error: null, type: 'assignment' },
      { value: '0xFF', error: null, type: 'number', numericValue: 255 },
      { value: '5.3e+3', error: null, type: 'number', numericValue: 5300 },
    ]

    expect(sumNumericResults(results)).toBe(5565)
  })

  it('ignores Infinity and NaN when numericValue is absent', () => {
    const results: LineResult[] = [
      { value: 'Infinity', error: null, type: 'number' },
      { value: 'NaN', error: null, type: 'number' },
    ]

    expect(sumNumericResults(results)).toBe(0)
  })
})
