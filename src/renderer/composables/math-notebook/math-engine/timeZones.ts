import type { DateFormatStyle } from './format'
import type { LineResult, SpecialLineResult } from './types'
import { MONTH_NAME_TO_INDEX, timeZoneAliases } from './constants'
import { formatMathDate } from './format'
import { splitByKeyword } from './utils'

interface ParsedTemporalExpression {
  date: Date
  explicitDate: boolean
}

interface TimeZoneDifferenceOptions {
  createHourUnit: (hours: number) => any
  formatResult: (value: any) => LineResult
}

type NumericDateOrder = 'mdy' | 'dmy' | 'ymd'

const numericDateOrderCache = new Map<string, NumericDateOrder>()

function getLocalTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

function getSupportedTimeZones() {
  if (typeof Intl.supportedValuesOf !== 'function')
    return []

  return Intl.supportedValuesOf('timeZone')
}

function normalizeTimeZoneInput(value: string) {
  return value.toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
}

function resolveTimeZone(value: string) {
  const normalized = normalizeTimeZoneInput(value)

  if (timeZoneAliases[normalized]) {
    return timeZoneAliases[normalized]
  }

  return (
    getSupportedTimeZones().find((timeZone) => {
      const lowerTimeZone = normalizeTimeZoneInput(
        timeZone.replace(/\//g, ' '),
      )
      const cityName = normalizeTimeZoneInput(timeZone.split('/').at(-1) || '')

      return lowerTimeZone === normalized || cityName === normalized
    }) || null
  )
}

function getTimeZoneParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  const parts = formatter.formatToParts(date)
  const getPartValue = (type: string) =>
    Number(parts.find(part => part.type === type)?.value)

  return {
    year: getPartValue('year'),
    month: getPartValue('month'),
    day: getPartValue('day'),
    hour: getPartValue('hour'),
    minute: getPartValue('minute'),
    second: getPartValue('second'),
  }
}

function zonedDateToUtc(
  parts: {
    year: number
    month: number
    day: number
    hour: number
    minute: number
  },
  timeZone: string,
) {
  let utcTimestamp = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    0,
  )

  for (let iteration = 0; iteration < 3; iteration++) {
    const actualParts = getTimeZoneParts(new Date(utcTimestamp), timeZone)
    const expectedTimestamp = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      0,
    )
    const actualTimestamp = Date.UTC(
      actualParts.year,
      actualParts.month - 1,
      actualParts.day,
      actualParts.hour,
      actualParts.minute,
      0,
    )

    utcTimestamp += expectedTimestamp - actualTimestamp
  }

  return new Date(utcTimestamp)
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string) {
  const parts = getTimeZoneParts(date, timeZone)
  const zonedTimestamp = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )

  return (zonedTimestamp - date.getTime()) / (1000 * 60)
}

function parseClockParts(value: string) {
  const timeMatch = value
    .trim()
    .match(/^(\d{1,2})(?::(\d{2}))?(?:\s*(am|pm))?$/i)
  if (!timeMatch) {
    return null
  }

  const [, hourText, minuteText, meridiem] = timeMatch
  let hours = Number(hourText)
  const minutes = Number(minuteText || '0')

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null
  }

  if (meridiem?.toLowerCase() === 'pm' && hours < 12) {
    hours += 12
  }
  if (meridiem?.toLowerCase() === 'am' && hours === 12) {
    hours = 0
  }

  return { hour: hours, minute: minutes }
}

function splitTemporalExpressionWithLeadingTime(value: string) {
  const tokens = value.trim().split(/\s+/).filter(Boolean)

  for (let length = Math.min(3, tokens.length); length >= 1; length--) {
    const timeCandidate = tokens.slice(0, length).join(' ')
    const timeParts = parseClockParts(timeCandidate)

    if (timeParts) {
      const remainder = tokens.slice(length).join(' ')
      if (remainder) {
        return {
          timeParts,
          remainder,
        }
      }
    }
  }

  return null
}

function getCurrentDatePartsInTimeZone(now: Date, timeZone: string) {
  const parts = getTimeZoneParts(now, timeZone)
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
  }
}

function shiftDateParts(
  parts: { year: number, month: number, day: number },
  dayDelta: number,
) {
  const shifted = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + dayDelta),
  )
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  }
}

function isValidDateParts(year: number, month: number, day: number): boolean {
  if (
    !Number.isInteger(year)
    || !Number.isInteger(month)
    || !Number.isInteger(day)
  ) {
    return false
  }

  if (month < 1 || month > 12 || day < 1) {
    return false
  }

  const daysInMonth = new Date(year, month, 0).getDate()
  return day <= daysInMonth
}

function toDateParts(year: number, month: number, day: number) {
  if (!isValidDateParts(year, month, day)) {
    return null
  }

  return { year, month, day }
}

function getNumericDateOrder(locale: string): NumericDateOrder {
  const cachedOrder = numericDateOrderCache.get(locale)
  if (cachedOrder) {
    return cachedOrder
  }

  let order: NumericDateOrder = 'dmy'

  try {
    const parts = new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(new Date(2001, 10, 22))
    const signature = parts
      .filter(
        part =>
          part.type === 'year' || part.type === 'month' || part.type === 'day',
      )
      .map(part => part.type)
      .join('-')

    if (signature === 'month-day-year') {
      order = 'mdy'
    }
    else if (signature === 'year-month-day') {
      order = 'ymd'
    }
  }
  catch {
    order = 'dmy'
  }

  numericDateOrderCache.set(locale, order)
  return order
}

function parseDateParts(
  value: string,
  now: Date,
  timeZone: string,
  locale = 'en-US',
) {
  const trimmed = value.trim().replace(/,/g, '')
  const currentDateParts = getCurrentDatePartsInTimeZone(now, timeZone)

  if (!trimmed) {
    return null
  }

  if (/^today$/i.test(trimmed)) {
    return currentDateParts
  }

  if (/^tomorrow$/i.test(trimmed)) {
    return shiftDateParts(currentDateParts, 1)
  }

  if (/^yesterday$/i.test(trimmed)) {
    return shiftDateParts(currentDateParts, -1)
  }

  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (isoMatch) {
    return toDateParts(
      Number(isoMatch[1]),
      Number(isoMatch[2]),
      Number(isoMatch[3]),
    )
  }

  const slashYearLastMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slashYearLastMatch) {
    const order = getNumericDateOrder(locale)
    const year = Number(slashYearLastMatch[3])
    const left = Number(slashYearLastMatch[1])
    const right = Number(slashYearLastMatch[2])

    if (order === 'mdy') {
      return toDateParts(year, left, right)
    }

    if (order === 'dmy') {
      return toDateParts(year, right, left)
    }

    return null
  }

  const slashYearFirstMatch = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/)
  if (slashYearFirstMatch && getNumericDateOrder(locale) === 'ymd') {
    return toDateParts(
      Number(slashYearFirstMatch[1]),
      Number(slashYearFirstMatch[2]),
      Number(slashYearFirstMatch[3]),
    )
  }

  const dottedMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?$/)
  if (dottedMatch) {
    return toDateParts(
      Number(dottedMatch[3] || currentDateParts.year),
      Number(dottedMatch[2]),
      Number(dottedMatch[1]),
    )
  }

  const monthNameMatch = trimmed.match(
    /^([a-z]+)\s+(\d{1,2})(?:\s+(\d{4}))?$/i,
  )
  if (monthNameMatch) {
    const monthIndex = MONTH_NAME_TO_INDEX[monthNameMatch[1].toLowerCase()]
    if (!monthIndex) {
      return null
    }

    return toDateParts(
      Number(monthNameMatch[3] || currentDateParts.year),
      monthIndex,
      Number(monthNameMatch[2]),
    )
  }

  return null
}

function resolveTrailingTimeZone(value: string) {
  const tokens = value.trim().split(/\s+/).filter(Boolean)
  const maxParts = Math.min(4, tokens.length)

  for (let length = maxParts; length >= 1; length--) {
    const timeZoneText = tokens.slice(-length).join(' ')
    const timeZone = resolveTimeZone(timeZoneText)

    if (timeZone) {
      return {
        timeZone,
        expression: tokens.slice(0, -length).join(' ').trim(),
      }
    }
  }

  return null
}

function parseTemporalBody(
  value: string,
  now: Date,
  timeZone: string,
  locale = 'en-US',
): ParsedTemporalExpression | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const timeOnly = parseClockParts(trimmed)
  if (timeOnly) {
    const dateParts = getCurrentDatePartsInTimeZone(now, timeZone)
    return {
      date: zonedDateToUtc(
        {
          ...dateParts,
          hour: timeOnly.hour,
          minute: timeOnly.minute,
        },
        timeZone,
      ),
      explicitDate: false,
    }
  }

  const timeAtEndMatch = trimmed.match(
    /^(.*\S)\s+(\d{1,2}(?::\d{2})?(?:\s*(?:am|pm))?)$/i,
  )
  if (timeAtEndMatch) {
    const dateParts = parseDateParts(timeAtEndMatch[1], now, timeZone, locale)
    const timeParts = parseClockParts(timeAtEndMatch[2])

    if (dateParts && timeParts) {
      return {
        date: zonedDateToUtc(
          {
            ...dateParts,
            hour: timeParts.hour,
            minute: timeParts.minute,
          },
          timeZone,
        ),
        explicitDate: true,
      }
    }
  }

  const leadingTime = splitTemporalExpressionWithLeadingTime(trimmed)
  if (leadingTime) {
    const dateParts = parseDateParts(
      leadingTime.remainder,
      now,
      timeZone,
      locale,
    )

    if (dateParts) {
      return {
        date: zonedDateToUtc(
          {
            ...dateParts,
            hour: leadingTime.timeParts.hour,
            minute: leadingTime.timeParts.minute,
          },
          timeZone,
        ),
        explicitDate: true,
      }
    }
  }

  const dateParts = parseDateParts(trimmed, now, timeZone, locale)
  if (dateParts) {
    return {
      date: zonedDateToUtc(
        {
          ...dateParts,
          hour: 0,
          minute: 0,
        },
        timeZone,
      ),
      explicitDate: true,
    }
  }

  return null
}

function parseZonedTemporalExpression(
  value: string,
  now: Date,
  locale = 'en-US',
) {
  const resolved = resolveTrailingTimeZone(value)
  if (!resolved) {
    return null
  }

  return parseTemporalBody(resolved.expression, now, resolved.timeZone, locale)
}

export function parseExplicitLocalTemporalExpression(
  value: string,
  now: Date,
  locale = 'en-US',
) {
  const trimmed = value.trim()
  const localTimeZone = getLocalTimeZone()

  if (!trimmed) {
    return null
  }

  // Bare numeric M/D is too ambiguous and should remain arithmetic.
  if (/^\d{1,2}\/\d{1,2}$/.test(trimmed)) {
    return null
  }

  const timeAtEndMatch = trimmed.match(
    /^(.*\S)\s+(\d{1,2}(?::\d{2})?(?:\s*(?:am|pm))?)$/i,
  )
  if (timeAtEndMatch) {
    const dateParts = parseDateParts(
      timeAtEndMatch[1],
      now,
      localTimeZone,
      locale,
    )
    const timeParts = parseClockParts(timeAtEndMatch[2])

    if (dateParts && timeParts) {
      return {
        date: new Date(
          dateParts.year,
          dateParts.month - 1,
          dateParts.day,
          timeParts.hour,
          timeParts.minute,
        ),
        explicitDate: true,
      }
    }
  }

  const leadingTime = splitTemporalExpressionWithLeadingTime(trimmed)
  if (leadingTime) {
    const dateParts = parseDateParts(
      leadingTime.remainder,
      now,
      localTimeZone,
      locale,
    )

    if (dateParts) {
      return {
        date: new Date(
          dateParts.year,
          dateParts.month - 1,
          dateParts.day,
          leadingTime.timeParts.hour,
          leadingTime.timeParts.minute,
        ),
        explicitDate: true,
      }
    }
  }

  const dateParts = parseDateParts(trimmed, now, localTimeZone, locale)
  if (!dateParts) {
    return null
  }

  return {
    date: new Date(dateParts.year, dateParts.month - 1, dateParts.day, 0, 0),
    explicitDate: true,
  }
}

function resolveCurrentTimeZoneExpression(line: string) {
  const lowerLine = line.trim().toLowerCase()

  if (
    lowerLine === 'time'
    || lowerLine === 'time()'
    || lowerLine === 'now'
    || lowerLine === 'now()'
  ) {
    return getLocalTimeZone()
  }

  if (lowerLine.endsWith(' time')) {
    return resolveTimeZone(line.slice(0, -5))
  }

  if (lowerLine.endsWith(' now')) {
    return resolveTimeZone(line.slice(0, -4))
  }

  if (lowerLine.startsWith('time in ')) {
    return resolveTimeZone(line.slice(8))
  }

  if (lowerLine.startsWith('now in ')) {
    return resolveTimeZone(line.slice(7))
  }

  return null
}

function computeTimeZoneDifference(
  tz1: string,
  tz2: string,
  now: Date,
  options: TimeZoneDifferenceOptions,
): SpecialLineResult {
  const diffHours
    = (getTimeZoneOffsetMinutes(now, tz1) - getTimeZoneOffsetMinutes(now, tz2))
      / 60
  const result = options.createHourUnit(diffHours)
  return {
    lineResult: options.formatResult(result),
    rawResult: result,
  }
}

export function evaluateTimeZoneDifferenceLine(
  line: string,
  now: Date,
  options: TimeZoneDifferenceOptions,
): SpecialLineResult | null {
  // "time difference between X and Y" / "difference between X & Y"
  const lower = line.toLowerCase()
  const betweenIdx = lower.indexOf(' between ')
  if (
    betweenIdx >= 0
    && /^(?:time\s+)?difference$/i.test(line.slice(0, betweenIdx).trim())
  ) {
    const rest = line.slice(betweenIdx + 9)
    const andIdx = rest.search(/\s+(?:and|&)\s+/i)
    if (andIdx > 0) {
      const separator = rest.match(/\s+(?:and|&)\s+/i)!
      const tz1 = resolveTimeZone(rest.slice(0, andIdx).trim())
      const tz2 = resolveTimeZone(
        rest.slice(andIdx + separator[0].length).trim(),
      )
      if (tz1 && tz2) {
        return computeTimeZoneDifference(tz2, tz1, now, options)
      }
    }
  }

  // "X time - Y time" / "now in X - now in Y"
  const subtractionIndex = line.indexOf(' - ')
  if (subtractionIndex <= 0) {
    return null
  }

  const left = line.slice(0, subtractionIndex).trim()
  const right = line.slice(subtractionIndex + 3).trim()

  if (!left || !right) {
    return null
  }

  const leftTimeZone = resolveCurrentTimeZoneExpression(left)
  const rightTimeZone = resolveCurrentTimeZoneExpression(right)

  if (!leftTimeZone || !rightTimeZone) {
    return null
  }

  return computeTimeZoneDifference(leftTimeZone, rightTimeZone, now, options)
}

export function evaluateTimeZoneLine(
  line: string,
  now: Date,
  locale = 'en-US',
  dateFormat: DateFormatStyle = 'numeric',
): SpecialLineResult | null {
  const lowerLine = line.toLowerCase()
  const localTimeZone = getLocalTimeZone()

  if (
    lowerLine === 'time'
    || lowerLine === 'time()'
    || lowerLine === 'now'
    || lowerLine === 'now()'
  ) {
    return {
      lineResult: {
        value: formatMathDate(now, locale, dateFormat, {
          timeZone: localTimeZone,
          timeZoneName: true,
        }),
        error: null,
        type: 'date',
      },
      rawResult: now,
    }
  }

  if (lowerLine.endsWith(' time')) {
    const timeZone = resolveTimeZone(line.slice(0, -5))
    if (!timeZone) {
      return null
    }

    return {
      lineResult: {
        value: formatMathDate(now, locale, dateFormat, {
          timeZone,
          timeZoneName: true,
        }),
        error: null,
        type: 'date',
      },
      rawResult: now,
    }
  }

  if (lowerLine.endsWith(' now')) {
    const timeZone = resolveTimeZone(line.slice(0, -4))
    if (!timeZone) {
      return null
    }

    return {
      lineResult: {
        value: formatMathDate(now, locale, dateFormat, {
          timeZone,
          timeZoneName: true,
        }),
        error: null,
        type: 'date',
      },
      rawResult: now,
    }
  }

  if (lowerLine.startsWith('time in ')) {
    const timeZone = resolveTimeZone(line.slice(8))
    if (!timeZone) {
      return null
    }

    return {
      lineResult: {
        value: formatMathDate(now, locale, dateFormat, {
          timeZone,
          timeZoneName: true,
        }),
        error: null,
        type: 'date',
      },
      rawResult: now,
    }
  }

  if (lowerLine.startsWith('now in ')) {
    const timeZone = resolveTimeZone(line.slice(7))
    if (!timeZone) {
      return null
    }

    return {
      lineResult: {
        value: formatMathDate(now, locale, dateFormat, {
          timeZone,
          timeZoneName: true,
        }),
        error: null,
        type: 'date',
      },
      rawResult: now,
    }
  }

  // "date in ZONE" → show current date in timezone (date only, no time)
  if (lowerLine.startsWith('date in ')) {
    const timeZone = resolveTimeZone(line.slice(8))
    if (timeZone) {
      return {
        lineResult: {
          value: formatMathDate(now, locale, dateFormat, {
            timeZone,
            dateOnly: true,
          }),
          error: null,
          type: 'date',
        },
        rawResult: now,
      }
    }
  }

  const conversionParts = splitByKeyword(line, [' in '])
  if (!conversionParts) {
    return null
  }

  const targetTimeZone = resolveTimeZone(conversionParts[1])
  if (!targetTimeZone) {
    return null
  }

  const parsedSourceExpression
    = parseZonedTemporalExpression(conversionParts[0], now, locale)
      || parseTemporalBody(conversionParts[0], now, localTimeZone, locale)
  if (!parsedSourceExpression) {
    return null
  }

  return {
    lineResult: {
      value: formatMathDate(parsedSourceExpression.date, locale, dateFormat, {
        timeZone: targetTimeZone,
        timeZoneName: true,
      }),
      error: null,
      type: 'date',
    },
    rawResult: parsedSourceExpression.date,
  }
}
