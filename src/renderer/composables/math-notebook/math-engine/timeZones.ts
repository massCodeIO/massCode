import type { LineResult, SpecialLineResult } from './types'
import { MONTH_NAME_TO_INDEX, timeZoneAliases } from './constants'
import { splitByKeyword } from './utils'

interface ParsedTemporalExpression {
  date: Date
  explicitDate: boolean
}

interface TimeZoneDifferenceOptions {
  createHourUnit: (hours: number) => any
  formatResult: (value: any) => LineResult
}

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

function formatTimeZoneDate(date: Date, timeZone: string, includeYear = false) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' as const } : {}),
    timeZoneName: 'short',
  }).format(date)
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

function parseDateParts(value: string, now: Date, timeZone: string) {
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
    return {
      year: Number(isoMatch[1]),
      month: Number(isoMatch[2]),
      day: Number(isoMatch[3]),
    }
  }

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/)
  if (slashMatch) {
    return {
      year: Number(slashMatch[3] || currentDateParts.year),
      month: Number(slashMatch[1]),
      day: Number(slashMatch[2]),
    }
  }

  const dottedMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?$/)
  if (dottedMatch) {
    return {
      year: Number(dottedMatch[3] || currentDateParts.year),
      month: Number(dottedMatch[2]),
      day: Number(dottedMatch[1]),
    }
  }

  const monthNameMatch = trimmed.match(
    /^([a-z]+)\s+(\d{1,2})(?:\s+(\d{4}))?$/i,
  )
  if (monthNameMatch) {
    const monthIndex = MONTH_NAME_TO_INDEX[monthNameMatch[1].toLowerCase()]
    if (!monthIndex) {
      return null
    }

    return {
      year: Number(monthNameMatch[3] || currentDateParts.year),
      month: monthIndex,
      day: Number(monthNameMatch[2]),
    }
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
    const dateParts = parseDateParts(timeAtEndMatch[1], now, timeZone)
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
    const dateParts = parseDateParts(leadingTime.remainder, now, timeZone)

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

  const dateParts = parseDateParts(trimmed, now, timeZone)
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

function parseZonedTemporalExpression(value: string, now: Date) {
  const resolved = resolveTrailingTimeZone(value)
  if (!resolved) {
    return null
  }

  return parseTemporalBody(resolved.expression, now, resolved.timeZone)
}

export function parseExplicitLocalTemporalExpression(value: string, now: Date) {
  const trimmed = value.trim()
  const localTimeZone = getLocalTimeZone()

  if (!trimmed) {
    return null
  }

  const timeAtEndMatch = trimmed.match(
    /^(.*\S)\s+(\d{1,2}(?::\d{2})?(?:\s*(?:am|pm))?)$/i,
  )
  if (timeAtEndMatch) {
    const dateParts = parseDateParts(timeAtEndMatch[1], now, localTimeZone)
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
    const dateParts = parseDateParts(leadingTime.remainder, now, localTimeZone)

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

  const dateParts = parseDateParts(trimmed, now, localTimeZone)
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
  absolute = false,
): SpecialLineResult {
  let diffHours
    = (getTimeZoneOffsetMinutes(now, tz1) - getTimeZoneOffsetMinutes(now, tz2))
      / 60
  if (absolute)
    diffHours = Math.abs(diffHours)
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
        return computeTimeZoneDifference(tz1, tz2, now, options, true)
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
        value: formatTimeZoneDate(now, localTimeZone),
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
        value: formatTimeZoneDate(now, timeZone),
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
        value: formatTimeZoneDate(now, timeZone),
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
        value: formatTimeZoneDate(now, timeZone),
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
        value: formatTimeZoneDate(now, timeZone),
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
      const formatted = new Intl.DateTimeFormat('en-US', {
        timeZone,
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(now)
      return {
        lineResult: { value: formatted, error: null, type: 'date' },
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
    = parseZonedTemporalExpression(conversionParts[0], now)
      || parseTemporalBody(conversionParts[0], now, localTimeZone)
  if (!parsedSourceExpression) {
    return null
  }

  return {
    lineResult: {
      value: formatTimeZoneDate(
        parsedSourceExpression.date,
        targetTimeZone,
        parsedSourceExpression.explicitDate,
      ),
      error: null,
      type: 'date',
    },
    rawResult: parsedSourceExpression.date,
  }
}
