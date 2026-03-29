import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  evalLines,
  setFormatSettings,
  setupCurrencyRates,
} from './mathEngineTestUtils'

function loadFixture(name: string) {
  return readFileSync(
    new URL(
      `../math-notebook/math-engine/__tests__/fixtures/${name}.txt`,
      import.meta.url,
    ),
    'utf8',
  )
}

beforeEach(() => {
  setupCurrencyRates()
  setFormatSettings('en-US', 6, 'numeric')
})

describe('real-world budget document', () => {
  it('evaluates supported budget lines inside a full monthly plan', () => {
    const results = evalLines(loadFixture('real-world-budget'))

    expect(results[8]).toMatchObject({ type: 'number', value: '0.2' })

    expect(results[14]).toMatchObject({ type: 'unit', value: '200 USD' })
    expect(results[15]).toMatchObject({ type: 'unit', value: '300 USD' })
    expect(results[16]).toMatchObject({ type: 'unit', value: '80 USD' })
    expect(results[17]).toMatchObject({ type: 'unit', value: '60 USD' })
    expect(results[18]).toMatchObject({ type: 'unit', value: '50 USD' })
    expect(results[26]).toMatchObject({ type: 'unit', value: '1,050 USD' })

    expect(results[39]).toMatchObject({ type: 'number', value: '$14,693.28' })
    expect(results[40]).toMatchObject({ type: 'number', value: '$4,693.28' })
    expect(results[41]).toMatchObject({ type: 'number', value: '$202.76' })
  })
})

describe('real-world travel document', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-06T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('evaluates supported travel planning lines inside one document', () => {
    const results = evalLines(loadFixture('real-world-travel'))

    expect(results[3]).toMatchObject({ type: 'unit', value: '850 USD' })
    expect(results[4]).toMatchObject({ type: 'unit', value: '100 USD' })
    expect(results[5]).toMatchObject({ type: 'unit', value: '950 USD' })

    expect(results[8]).toMatchObject({
      type: 'assignment',
      value: '120 USD / days',
    })
    expect(results[9]).toMatchObject({ type: 'assignment', value: '7' })
    expect(results[10]).toMatchObject({
      type: 'unit',
      value: '840 USD / days',
    })

    expect(results[14].type).toBe('date')
    expect(results[14].value).toContain('2026')
    expect(results[14].value).toContain('GMT')
    expect(results[15]).toMatchObject({ type: 'unit', value: '6 hour' })
    expect(results[19]).toMatchObject({ type: 'number', value: '7 days' })
    expect(results[20].type).toBe('date')
    expect(results[20].value).toContain('2026')

    expect(results[23]).toMatchObject({ type: 'unit', value: '50.70632 lb' })
    expect(results[31]).toMatchObject({ type: 'unit', value: '45 EUR' })
    expect(results[32]).toMatchObject({ type: 'unit', value: '6.75 EUR' })
  })
})

describe('real-world cooking document', () => {
  it('evaluates supported recipe conversion lines inside one document', () => {
    const results = evalLines(loadFixture('real-world-cooking'))

    expect(results[9]).toMatchObject({ type: 'number', value: '2.14 cups' })
    expect(results[10]).toMatchObject({ type: 'number', value: '1.00 cups' })
    expect(results[11]).toMatchObject({ type: 'number', value: '0.46 cups' })

    expect(results[14]).toMatchObject({ type: 'number', value: '450' })
    expect(results[15]).toMatchObject({ type: 'number', value: '300' })
    expect(results[16]).toMatchObject({ type: 'number', value: '150' })

    expect(results[19]).toMatchObject({ type: 'number', value: '0.593 g/cm³' })
    expect(results[20]).toMatchObject({ type: 'number', value: '0.845 g/cm³' })
    expect(results[21]).toMatchObject({ type: 'number', value: '0.911 g/cm³' })
    expect(results[22]).toMatchObject({ type: 'number', value: '1.42 g/cm³' })

    expect(results[25]).toMatchObject({
      type: 'unit',
      value: '176.666667 celsius',
    })
    expect(results[26]).toMatchObject({
      type: 'unit',
      value: '356 fahrenheit',
    })
    expect(results[29]).toMatchObject({ type: 'number', value: '45 min' })
    expect(results[30]).toMatchObject({
      type: 'number',
      value: '1 hour 30 min',
    })
  })
})

describe('real-world developer document', () => {
  it('evaluates supported engineering calculations inside one document', () => {
    const results = evalLines(loadFixture('real-world-dev'))

    expect(results[4]).toMatchObject({ type: 'unit', value: '0.465661 GiB' })
    expect(results[5]).toMatchObject({ type: 'unit', value: '10.737418 GB' })
    expect(results[6]).toMatchObject({ type: 'unit', value: '268.435456 MB' })
    expect(results[10]).toMatchObject({ type: 'unit', value: '8,000 Mb' })

    expect(results[13]).toMatchObject({ type: 'unit', value: '16 px' })
    expect(results[14]).toMatchObject({ type: 'assignment', value: '18' })
    expect(results[15]).toMatchObject({ type: 'unit', value: '24 px' })
    expect(results[16]).toMatchObject({ type: 'assignment', value: '326' })
    expect(results[17]).toMatchObject({ type: 'unit', value: '128.346457 px' })

    expect(results[20]).toMatchObject({ type: 'assignment', value: '16' })
    expect(results[21]).toMatchObject({ type: 'unit', value: '40 px' })
    expect(results[22]).toMatchObject({ type: 'unit', value: '10.601227 pt' })

    expect(results[25]).toMatchObject({ type: 'number', value: '42' })
    expect(results[26]).toMatchObject({ type: 'number', value: '15' })
    expect(results[27]).toMatchObject({ type: 'number', value: '2.8' })
    expect(results[28]).toMatchObject({ type: 'number', value: '3' })

    expect(results[31]).toMatchObject({ type: 'unit', value: '210 minutes' })
    expect(results[33]).toMatchObject({
      type: 'number',
      value: '1 day 16 hours',
    })

    expect(results[36]).toMatchObject({ type: 'unit', value: '300 fps' })
    expect(results[37]).toMatchObject({ type: 'unit', value: '43,200 frames' })
    expect(results[38]).toMatchObject({ type: 'assignment', value: '86,400' })

    expect(results[41]).toMatchObject({ type: 'number', value: '0xFF' })
    expect(results[42]).toMatchObject({ type: 'number', value: '0b11111111' })
    expect(results[43]).toMatchObject({ type: 'number', value: '255' })
    expect(results[44]).toMatchObject({ type: 'number', value: '0b11000000' })
    expect(results[45]).toMatchObject({ type: 'number', value: '0xA8' })

    expect(results[48]).toMatchObject({ type: 'unit', value: '1.5 kHz' })
    expect(results[49]).toMatchObject({
      type: 'number',
      value: '129,600,000',
    })
  })
})
