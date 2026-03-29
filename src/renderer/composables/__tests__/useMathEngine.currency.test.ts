/* eslint-disable test/prefer-lowercase-title */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  evalLine,
  expectNumericClose,
  setCurrencyServiceState,
  setFormatSettings,
  setupCurrencyRates,
} from './mathEngineTestUtils'

beforeEach(() => {
  setupCurrencyRates()
  setFormatSettings('en-US', 6, 'numeric')
})

describe('currency', () => {
  it('waits for currency rates while loading', () => {
    setCurrencyServiceState('loading')

    const result = evalLine('100 USD to EUR')
    expect(result.type).toBe('pending')
    expect(result.value).toBeNull()
  })

  it('shows service unavailable when rates cannot be loaded', () => {
    setCurrencyServiceState(
      'unavailable',
      'Currency rates service unavailable',
    )

    const result = evalLine('100 USD to EUR')
    expect(result.type).toBe('empty')
    expect(result.error).toBe('Currency rates service unavailable')
  })

  it('does not treat pound weight as currency while loading', () => {
    setCurrencyServiceState('loading')

    const result = evalLine('1 pound to lb')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('lb')
  })

  it('$ symbol', () => {
    const result = evalLine('$30')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('USD')
  })

  it('€ symbol', () => {
    const result = evalLine('€50')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('EUR')
  })

  it('£ symbol', () => {
    const result = evalLine('£20')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('GBP')
  })

  it('ISO code', () => {
    const result = evalLine('30 USD')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('USD')
  })

  it('currency addition', () => {
    const result = evalLine('$10 + $20')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('USD')
  })

  it('currency conversion', () => {
    const result = evalLine('100 USD to EUR')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('EUR')
    expectNumericClose('100 USD to EUR', 92)
  })

  it('label with currency', () => {
    const result = evalLine('Price: $11 + $34.45')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('USD')
  })

  it('currency word names', () => {
    const result = evalLine('5 dollars + 10 dollars')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('USD')
    expectNumericClose('5 dollars + 10 dollars', 15)
  })

  it('euros word', () => {
    const result = evalLine('10 euros')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('EUR')
  })

  it('rubles word', () => {
    const result = evalLine('500 rubles')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('RUB')
  })

  it('implicit rate: 4 days * $30', () => {
    const result = evalLine('4 days * $30')
    expect(result.value).toBe('120 USD')
  })

  it('implicit rate: 30 EUR * 4 days', () => {
    const result = evalLine('30 EUR * 4 days')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('EUR')
  })
})

describe('currency prefixed symbols', () => {
  it('CA$ symbol (CAD)', () => {
    const result = evalLine('CA$100')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('CAD')
  })

  it('AU$ symbol (AUD)', () => {
    const result = evalLine('AU$50')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('AUD')
  })

  it('HK$ symbol (HKD)', () => {
    const result = evalLine('HK$200')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('HKD')
  })

  it('NZ$ symbol (NZD)', () => {
    const result = evalLine('NZ$75')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('NZD')
  })
})

describe('custom rates', () => {
  it('50 EUR in USD at 1.05 USD/EUR', () => {
    const result = evalLine('50 EUR in USD at 1.05 USD/EUR')
    expect(result.value).toContain('52.5')
  })
})

describe('modifier compatibility', () => {
  it('returns controlled error for timezone format modifier', () => {
    const result = evalLine('time in Paris in hex')
    expect(result.type).toBe('empty')
    expect(result.error).toContain(
      'Modifier is not supported for this expression type',
    )
  })

  it('returns controlled error for css rounding modifier', () => {
    const result = evalLine('12 pt in px rounded')
    expect(result.type).toBe('empty')
    expect(result.error).toContain(
      'Modifier is not supported for this expression type',
    )
  })
})
