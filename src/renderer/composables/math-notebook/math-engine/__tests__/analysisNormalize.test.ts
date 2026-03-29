import { describe, expect, it } from 'vitest'
import { analysisNormalize } from '../pipeline/analysisNormalize'

describe('analysisNormalize', () => {
  it('plain expression', () => {
    const view = analysisNormalize('10 + 5')
    expect(view.raw).toBe('10 + 5')
    expect(view.expression).toBe('10 + 5')
    expect(view.normalized).toBe('10 + 5')
    expect(view.label).toBeUndefined()
  })

  it('strips label prefix', () => {
    const view = analysisNormalize('Price: $100 + $50')
    expect(view.expression).toBe('$100 + $50')
    expect(view.label).toBe('Price')
  })

  it('strips multi-word label', () => {
    const view = analysisNormalize('Monthly cost: 1200 / 12')
    expect(view.expression).toBe('1200 / 12')
    expect(view.label).toBe('Monthly cost')
  })

  it('strips quoted text', () => {
    const view = analysisNormalize('$275 for the "Model 227"')
    expect(view.expression).toBe('$275')
  })

  it('strips label and quoted text', () => {
    const view = analysisNormalize('Item: $99 "discount"')
    expect(view.expression).toBe('$99')
    expect(view.label).toBe('Item')
  })

  it('empty string', () => {
    const view = analysisNormalize('')
    expect(view.raw).toBe('')
    expect(view.expression).toBe('')
    expect(view.normalized).toBe('')
  })

  it('comment', () => {
    const view = analysisNormalize('// comment')
    expect(view.expression).toBe('// comment')
  })

  it('normalized is lowercase', () => {
    const view = analysisNormalize('5 USD to EUR')
    expect(view.normalized).toBe('5 usd to eur')
  })

  it('trims whitespace', () => {
    const view = analysisNormalize('  10 + 5  ')
    expect(view.raw).toBe('10 + 5')
    expect(view.expression).toBe('10 + 5')
  })
})
