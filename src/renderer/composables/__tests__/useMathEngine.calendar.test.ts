/* eslint-disable test/prefer-lowercase-title */
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

describe('calendar calculations', () => {
  it('days since a date', () => {
    const result = evalLine('days since January 1')
    expect(result.value).toContain('day')
    expect(result.numericValue).toBeGreaterThan(0)
  })

  it('days till a date', () => {
    const result = evalLine('days till December 25')
    expect(result.value).toContain('day')
    expect(result.numericValue).toBeGreaterThan(0)
  })

  it('days between two dates', () => {
    const result = evalLine('days between March 1 and March 31')
    expect(result.value).toBe('30 days')
    expect(result.numericValue).toBe(30)
  })

  it('X from now', () => {
    const result = evalLine('5 days from now')
    expect(result.type).toBe('date')
  })

  it('X ago', () => {
    const result = evalLine('3 days ago')
    expect(result.type).toBe('date')
  })

  it('day of the week on date', () => {
    const result = evalLine('day of the week on January 24, 1984')
    expect(result.value).toBe('Tuesday')
  })

  it('weekday on date', () => {
    const result = evalLine('weekday on March 9, 2024')
    expect(result.value).toBe('Saturday')
  })

  it('week of year', () => {
    const result = evalLine('week of year')
    expect(result.numericValue).toBeGreaterThan(0)
    expect(result.numericValue).toBeLessThanOrEqual(53)
  })

  it('week number on date', () => {
    const result = evalLine('week number on March 12, 2021')
    expect(result.numericValue).toBeGreaterThan(0)
  })

  it('days in February 2020 (leap)', () => {
    const result = evalLine('days in February 2020')
    expect(result.value).toBe('29 days')
  })

  it('days in February 2021 (non-leap)', () => {
    const result = evalLine('days in February 2021')
    expect(result.value).toBe('28 days')
  })

  it('days in Q1', () => {
    const result = evalLine('days in Q1')
    expect(result.numericValue).toBeGreaterThanOrEqual(90)
    expect(result.numericValue).toBeLessThanOrEqual(91)
  })

  it('days in Q2', () => {
    const result = evalLine('days in Q2')
    expect(result.value).toBe('91 days')
  })

  it('days in Q3', () => {
    const result = evalLine('days in Q3')
    expect(result.value).toBe('92 days')
  })

  it('days in Q4', () => {
    const result = evalLine('days in Q4')
    expect(result.value).toBe('92 days')
  })

  it('days between same date (0 days)', () => {
    const result = evalLine('days between March 1 and March 1')
    expect(result.value).toBe('0 days')
  })

  it('3 months from now', () => {
    const result = evalLine('3 months from now')
    expect(result.type).toBe('date')
  })

  it('2 years ago', () => {
    const result = evalLine('2 years ago')
    expect(result.type).toBe('date')
  })

  it('1 week from now', () => {
    const result = evalLine('1 week from now')
    expect(result.type).toBe('date')
  })

  it('3 weeks after March 14, 2019', () => {
    const result = evalLine('3 weeks after March 14, 2019')
    expect(result.type).toBe('date')
  })

  it('28 days before March 12', () => {
    const result = evalLine('28 days before March 12')
    expect(result.type).toBe('date')
  })

  it('current timestamp', () => {
    const result = evalLine('current timestamp')
    expect(result.numericValue).toBeGreaterThan(1000000000)
  })
})

describe('workdays', () => {
  it('workdays in 3 weeks', () => {
    const result = evalLine('workdays in 3 weeks')
    expect(result.value).toBe('15 workdays')
    expect(result.numericValue).toBe(15)
  })

  it('workdays from date to date', () => {
    const result = evalLine('workdays from March 3 to March 7')
    expect(result.numericValue).toBeGreaterThan(0)
    expect(result.value).toContain('workday')
  })

  it('date to date in workdays', () => {
    const result = evalLine('March 3 to March 7 in workdays')
    expect(result.numericValue).toBeGreaterThan(0)
    expect(result.value).toContain('workday')
  })

  it('N workdays after date', () => {
    const result = evalLine('2 workdays after March 3, 2025')
    expect(result.type).toBe('date')
  })
})

describe('timestamps and ISO 8601', () => {
  it('date to timestamp', () => {
    const result = evalLine('January 1, 2020 to timestamp')
    expect(result.numericValue).toBeGreaterThan(1500000000)
    expect(result.type).toBe('number')
  })

  it('date as iso8601', () => {
    const result = evalLine('June 15, 2020 as iso8601')
    expect(result.value).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('ISO string to date', () => {
    const result = evalLine('2019-04-01T15:30:00 to date')
    expect(result.type).toBe('date')
  })

  it('millisecond timestamp to date', () => {
    const result = evalLine('1733823083000 to date')
    expect(result.type).toBe('date')
  })
})

describe('clock time intervals', () => {
  it('7:30 to 20:45', () => {
    const result = evalLine('7:30 to 20:45')
    expect(result.value).toBe('13 hours 15 min')
  })

  it('4pm to 3am', () => {
    const result = evalLine('4pm to 3am')
    expect(result.value).toBe('11 hours')
  })

  it('9am to 5pm', () => {
    const result = evalLine('9am to 5pm')
    expect(result.value).toBe('8 hours')
  })

  it('12am to 12pm', () => {
    const result = evalLine('12am to 12pm')
    expect(result.value).toBe('12 hours')
  })

  it('11pm to 1am (midnight crossing)', () => {
    const result = evalLine('11pm to 1am')
    expect(result.value).toBe('2 hours')
  })

  it('1.5 hours as timespan', () => {
    const result = evalLine('1.5 hours as timespan')
    expect(result.value).toBe('1 hour 30 min')
  })

  it('0 seconds as timespan', () => {
    const result = evalLine('0 seconds as timespan')
    expect(result.value).toBe('0 s')
  })
})

describe('timespans and laptimes', () => {
  it('5.5 minutes as timespan', () => {
    const result = evalLine('5.5 minutes as timespan')
    expect(result.value).toBe('5 min 30 s')
  })

  it('4.54 hours as timespan', () => {
    const result = evalLine('4.54 hours as timespan')
    expect(result.value).toContain('4 hours')
    expect(result.value).toContain('min')
  })

  it('72 days as timespan', () => {
    const result = evalLine('72 days as timespan')
    expect(result.value).toContain('10 weeks')
    expect(result.value).toContain('2 days')
  })

  it('5.5 minutes as laptime', () => {
    const result = evalLine('5.5 minutes as laptime')
    expect(result.value).toBe('00:05:30')
  })

  it('3h 5m 10s in seconds', () => {
    const result = evalLine('3h 5m 10s in seconds')
    expect(result.type).toBe('unit')
  })

  it('03:04:05 + 01:02:03 as laptime', () => {
    const result = evalLine('03:04:05 + 01:02:03 as laptime')
    expect(result.value).toBe('04:06:08')
  })
})

describe('video timecode', () => {
  it('30 fps * 3 minutes', () => {
    const result = evalLine('30 fps * 3 minutes')
    expect(result.type).toBe('unit')
  })

  it('timecode to frames: 00:30:10:00 @ 24 fps', () => {
    const result = evalLine('00:30:10:00 @ 24 fps in frames')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('43,440')
  })

  it('timecode arithmetic: add 50 frames', () => {
    const result = evalLine('03:10:20:05 at 30 fps + 50 frames')
    expect(result.type).toBe('unit')
  })

  it('default 24 fps for timecode', () => {
    const result = evalLine('00:00:01:00 in frames')
    expect(result.value).toContain('24')
  })
})
