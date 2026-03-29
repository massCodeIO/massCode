import { expect } from 'vitest'
import { useMathEngine } from '../math-notebook/useMathEngine'

export const TEST_CURRENCY_RATES = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  CAD: 1.36,
  RUB: 90,
  AUD: 1.55,
  NZD: 1.72,
  HKD: 7.82,
  JPY: 150,
  SGD: 1.35,
  TWD: 32.5,
}

const engine = useMathEngine()

export const {
  evaluateDocument,
  setCurrencyServiceState,
  setFormatSettings,
  updateCurrencyRates,
} = engine

export function evalLine(expr: string) {
  return evaluateDocument(expr)[0]
}

export function evalLines(text: string) {
  return evaluateDocument(text)
}

export function expectValue(expr: string, expected: string) {
  const result = evalLine(expr)
  expect(result.value).toBe(expected)
}

export function expectNumericClose(
  expr: string,
  expected: number,
  precision = 2,
) {
  const result = evalLine(expr)
  const num = Number.parseFloat(result.value!.replace(/,/g, ''))
  expect(num).toBeCloseTo(expected, precision)
}

export function expectDateWithYear(expr: string, year: string) {
  const result = evalLine(expr)
  expect(result.type).toBe('date')
  expect(result.value).toContain(year)
}

export function setupCurrencyRates() {
  updateCurrencyRates(TEST_CURRENCY_RATES)
}
