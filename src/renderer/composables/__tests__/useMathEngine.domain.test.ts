import { beforeEach, describe, expect, it } from 'vitest'
import {
  evalLine,
  setFormatSettings,
  setupCurrencyRates,
} from './mathEngineTestUtils'

beforeEach(() => {
  setupCurrencyRates()
  setFormatSettings('en-US', 6, 'numeric')
})

describe('finance calculations', () => {
  it('compound interest yearly', () => {
    const result = evalLine('$1,000 after 3 years at 7%')
    expect(result.value).toBe('$1,225.04')
  })

  it('compound interest monthly', () => {
    const result = evalLine('$1,000 for 3 years at 7% compounding monthly')
    expect(result.value).toBe('$1,232.93')
  })

  it('compound interest quarterly', () => {
    const result = evalLine('$1,000 for 3 years at 7% compounding quarterly')
    expect(result.value).toBe('$1,231.44')
  })

  it('interest on (interest only)', () => {
    const result = evalLine('interest on $1,000 after 3 years @ 7%')
    expect(result.value).toBe('$225.04')
  })

  it('simple ROI', () => {
    const result = evalLine('$500 invested $1,500 returned')
    expect(result.value).toBe('3x')
  })

  it('annual return', () => {
    const result = evalLine(
      'annual return on $1,000 invested $2,500 returned after 7 years',
    )
    expect(result.value).toBe('13.99%')
  })

  it('present value', () => {
    const result = evalLine('present value of $1,000 after 20 years at 10%')
    expect(result.value).toBe('$148.64')
  })

  it('monthly repayment', () => {
    const result = evalLine('monthly repayment on $10,000 over 6 years at 6%')
    expect(result.value).toBe('$165.73')
  })

  it('total repayment', () => {
    const result = evalLine('total repayment on $10,000 over 6 years at 6%')
    expect(result.value).toBe('$11,932.48')
  })

  it('total interest', () => {
    const result = evalLine('total interest on $10,000 over 6 years at 6%')
    expect(result.value).toBe('$1,932.48')
  })
})

describe('cooking calculations', () => {
  it('density of yogurt', () => {
    const result = evalLine('density of yogurt')
    expect(result.value).toBe('1.06 g/cm³')
  })

  it('density output respects active locale', () => {
    setFormatSettings('de-DE', 6, 'numeric')
    const result = evalLine('density of yogurt')
    expect(result.value).toBe('1,06 g/cm³')
  })

  it('density of olive oil', () => {
    const result = evalLine('density of olive oil')
    expect(result.value).toBe('0.916 g/cm³')
  })

  it('300g butter in cups', () => {
    const result = evalLine('300g butter in cups')
    expect(result.numericValue).toBeCloseTo(1.39, 1)
    expect(result.value).toContain('cup')
  })

  it('10 cups olive oil in grams', () => {
    const result = evalLine('10 cups olive oil in grams')
    expect(result.numericValue).toBeCloseTo(2168, -1)
    expect(result.value).toContain('grams')
  })

  it('100g nutella in tablespoons', () => {
    const result = evalLine('100g nutella in tbsp')
    expect(result.numericValue).toBeGreaterThan(5)
    expect(result.value).toContain('tbsp')
  })

  it('density of honey', () => {
    const result = evalLine('density of honey')
    expect(result.value).toBe('1.42 g/cm³')
  })
})
