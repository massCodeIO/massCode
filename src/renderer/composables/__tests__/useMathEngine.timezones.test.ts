/* eslint-disable test/prefer-lowercase-title */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  evalLine,
  evalLines,
  expectDateWithYear,
  expectNumericClose,
  setFormatSettings,
  setupCurrencyRates,
} from './mathEngineTestUtils'

beforeEach(() => {
  setupCurrencyRates()
  setFormatSettings('en-US', 6, 'numeric')
})

describe('time zones', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-06T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('PST time', () => {
    const result = evalLine('PST time')
    expect(result.type).toBe('date')
    expect(result.value).not.toBeNull()
  })

  it('time()', () => {
    const result = evalLine('time()')
    expect(result.type).toBe('date')
    expect(result.value).not.toBeNull()
  })

  it('time() + 1 day', () => {
    const result = evalLine('time() + 1 day')
    expect(result.type).toBe('date')
    expect(result.value).toContain(
      new Date('2026-03-07T12:00:00Z').toLocaleDateString('en-US'),
    )
  })

  it('now()', () => {
    const result = evalLine('now()')
    expect(result.type).toBe('date')
    expect(result.value).not.toBeNull()
  })

  it('now + 1 day', () => {
    const result = evalLine('now + 1 day')
    expect(result.type).toBe('date')
    expect(result.value).toContain(
      new Date('2026-03-07T12:00:00Z').toLocaleDateString('en-US'),
    )
  })

  it('Time in Madrid', () => {
    const result = evalLine('Time in Madrid')
    expect(result.type).toBe('date')
    expect(result.value).not.toBeNull()
  })

  it('now in Madrid', () => {
    const result = evalLine('now in Madrid')
    expect(result.type).toBe('date')
    expect(result.value).not.toBeNull()
  })

  it('Berlin now', () => {
    const result = evalLine('Berlin now')
    expect(result.type).toBe('date')
    expect(result.value).not.toBeNull()
  })

  it('PST time - Berlin time', () => {
    const result = evalLine('PST time - Berlin time')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('hour')
    expectNumericClose('PST time - Berlin time', -9, 2)
  })

  it('2:30 pm HKT in Berlin', () => {
    const result = evalLine('2:30 pm HKT in Berlin')
    expect(result.type).toBe('date')
    expect(result.value).not.toBeNull()
  })

  it('2:30 pm New York in Berlin', () => {
    const result = evalLine('2:30 pm New York in Berlin')
    expect(result.type).toBe('date')
    expect(result.value).not.toBeNull()
  })

  it('2026-03-06 PST in Berlin', () => {
    expectDateWithYear('2026-03-06 PST in Berlin', '2026')
  })

  it('2026-03-06 2:30 pm PST in Berlin', () => {
    expectDateWithYear('2026-03-06 2:30 pm PST in Berlin', '2026')
  })

  it('uses locale-aware full slash date in zoned expressions', () => {
    setFormatSettings('en-GB', 6, 'numeric')

    const result = evalLine('22/11/2005 PST in Berlin')
    expect(result.type).toBe('date')
    expect(result.value).toContain('2005')
  })

  it('Mar 6 2026 PST in Berlin', () => {
    expectDateWithYear('Mar 6 2026 PST in Berlin', '2026')
  })

  it('2:30 pm Mar 6 2026 PST in Berlin', () => {
    expectDateWithYear('2:30 pm Mar 6 2026 PST in Berlin', '2026')
  })

  it('tomorrow PST in Berlin', () => {
    expectDateWithYear('tomorrow PST in Berlin', '2026')
  })

  it('airport code: 7:30am LAX in Japan', () => {
    const result = evalLine('7:30 am LAX in Japan')
    expect(result.type).toBe('date')
    expect(result.value).not.toBeNull()
  })

  it('country name: time in Thailand', () => {
    const result = evalLine('time in Thailand')
    expect(result.type).toBe('date')
    expect(result.value).not.toBeNull()
  })

  it('country name: time in Germany', () => {
    const result = evalLine('time in Germany')
    expect(result.type).toBe('date')
    expect(result.value).not.toBeNull()
  })

  it('date in Vancouver', () => {
    const result = evalLine('date in Vancouver')
    expect(result.type).toBe('date')
    expect(result.value).not.toBeNull()
  })

  it('time difference between Seattle and Moscow (positive)', () => {
    const result = evalLine('time difference between Seattle and Moscow')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('hour')
    expect(result.value).not.toContain('-')
  })

  it('time difference between Moscow and Seattle (negative)', () => {
    const result = evalLine('time difference between Moscow and Seattle')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('-')
    expect(result.value).toContain('hour')
  })

  it('difference between PDT & AEST', () => {
    const result = evalLine('difference between PDT & AEST')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('hour')
  })
})

describe('fromunix', () => {
  it('converts unix timestamp to date', () => {
    const result = evalLine('fromunix(1446587186)')
    expect(result.type).toBe('date')
    expect(result.value).not.toBeNull()
  })

  it('fromunix(0) is epoch', () => {
    const result = evalLine('fromunix(0)')
    expect(result.type).toBe('date')
    expect(result.value).toContain('1970')
  })

  it('fromunix + 2 day', () => {
    const result = evalLine('fromunix(1446587186) + 2 day')
    expect(result.type).toBe('date')
    expect(result.value).toContain(
      new Date((1446587186 + 2 * 86400) * 1000).toLocaleDateString('en-US'),
    )
  })

  it('date variable + 2 day', () => {
    const results = evalLines('d = fromunix(1446587186)\nd + 2 day')
    expect(results[0].type).toBe('assignment')
    expect(results[1].type).toBe('date')
    expect(results[1].value).toContain(
      new Date((1446587186 + 2 * 86400) * 1000).toLocaleDateString('en-US'),
    )
  })

  it('local dotted date assignment + 2 day', () => {
    const results = evalLines('x = 12.03.2025\nx + 2 day')
    expect(results[0].type).toBe('assignment')
    expect(results[0].value).toContain(
      new Date(2025, 2, 12).toLocaleDateString('en-US'),
    )
    expect(results[1].type).toBe('date')
    expect(results[1].value).toContain(
      new Date(2025, 2, 14).toLocaleDateString('en-US'),
    )
  })
})
