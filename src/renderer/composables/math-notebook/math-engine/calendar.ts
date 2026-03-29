import type { LineResult } from './types'
import { MONTH_NAME_TO_INDEX } from './constants'
import { formatMathDate } from './format'

interface CalendarResult {
  lineResult: LineResult
  rawResult: any
}

function parseSimpleDate(text: string, now: Date): Date | null {
  const trimmed = text.trim().replace(/,/g, '')

  if (/^today$/i.test(trimmed))
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (/^tomorrow$/i.test(trimmed))
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  if (/^yesterday$/i.test(trimmed))
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)

  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso)
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))

  const mdy = trimmed.match(/^([a-z]+)\s+(\d{1,2})(?:\s+(\d{4}))?$/i)
  if (mdy) {
    const month = MONTH_NAME_TO_INDEX[mdy[1].toLowerCase()]
    if (month) {
      const year = mdy[3] ? Number(mdy[3]) : now.getFullYear()
      return new Date(year, month - 1, Number(mdy[2]))
    }
  }

  const dmy = trimmed.match(/^(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?$/i)
  if (dmy) {
    const month = MONTH_NAME_TO_INDEX[dmy[2].toLowerCase()]
    if (month) {
      const year = dmy[3] ? Number(dmy[3]) : now.getFullYear()
      return new Date(year, month - 1, Number(dmy[1]))
    }
  }

  return null
}

const DAY_NAMES_REVERSE = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 86400000
  return Math.round((b.getTime() - a.getTime()) / msPerDay)
}

function daysResult(count: number): CalendarResult {
  const abs = Math.abs(count)
  return {
    lineResult: {
      value: `${abs} ${abs === 1 ? 'day' : 'days'}`,
      error: null,
      type: 'number',
      numericValue: abs,
    },
    rawResult: abs,
  }
}

function parseTimeUnit(text: string): string {
  return text.toLowerCase().replace(/s$/, '')
}

function applyDateOffset(
  date: Date,
  amount: number,
  unit: string,
  direction: number,
) {
  if (unit === 'day')
    date.setDate(date.getDate() + amount * direction)
  else if (unit === 'week')
    date.setDate(date.getDate() + amount * 7 * direction)
  else if (unit === 'month')
    date.setMonth(date.getMonth() + amount * direction)
  else if (unit === 'year')
    date.setFullYear(date.getFullYear() + amount * direction)
}

function getWeekNumber(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1)
  const diff = date.getTime() - startOfYear.getTime()
  return Math.ceil((diff / 86400000 + startOfYear.getDay() + 1) / 7)
}

export function evaluateCalendarLine(
  line: string,
  now: Date,
  locale: string,
): CalendarResult | null {
  const lower = line.toLowerCase().trim()

  // "days since X" / "days till X" / "days until X"
  const sinceTillIdx = lower.search(/^days\s+(since|till|until)\s/)
  if (sinceTillIdx === 0) {
    const keyword = lower.match(/^days\s+(since|till|until)/)![1]
    const rest = line.slice(lower.indexOf(keyword) + keyword.length).trim()
    const date = parseSimpleDate(rest, now)
    if (date) {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const diff
        = keyword === 'since'
          ? daysBetween(date, today)
          : daysBetween(today, date)
      return daysResult(diff)
    }
  }

  // "days between X and Y"
  const betweenMatch = lower.match(/^days\s+between\s/)
  if (betweenMatch) {
    const rest = line.slice(betweenMatch[0].length)
    const andIdx = rest.toLowerCase().lastIndexOf(' and ')
    if (andIdx > 0) {
      const d1 = parseSimpleDate(rest.slice(0, andIdx), now)
      const d2 = parseSimpleDate(rest.slice(andIdx + 5), now)
      if (d1 && d2) {
        return daysResult(daysBetween(d1, d2))
      }
    }
  }

  // "X from now" / "X ago"
  const relMatch = lower.match(
    /^(\d+)\s+(days?|weeks?|months?|years?)\s+(from now|ago)$/,
  )
  if (relMatch) {
    const amount = Number(relMatch[1])
    const unit = parseTimeUnit(relMatch[2])
    const direction = relMatch[3] === 'ago' ? -1 : 1
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    applyDateOffset(today, amount, unit, direction)
    return {
      lineResult: {
        value: formatMathDate(today, locale),
        error: null,
        type: 'date',
      },
      rawResult: today,
    }
  }

  // "day of the week on DATE" / "weekday on DATE"
  const dowMatch = lower.match(/^(?:day of the week|weekday) on\s/)
  if (dowMatch) {
    const rest = line.slice(dowMatch[0].length)
    const date = parseSimpleDate(rest, now)
    if (date) {
      const dayName = DAY_NAMES_REVERSE[date.getDay()]
      return {
        lineResult: { value: dayName, error: null, type: 'number' },
        rawResult: dayName,
      }
    }
  }

  // "week of year" / "week number"
  if (/^week of year$/.test(lower) || /^week number$/.test(lower)) {
    const weekNumber = getWeekNumber(
      new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    )
    return {
      lineResult: {
        value: String(weekNumber),
        error: null,
        type: 'number',
        numericValue: weekNumber,
      },
      rawResult: weekNumber,
    }
  }

  // "week number on DATE"
  const weekOnMatch = lower.match(/^week number on\s/)
  if (weekOnMatch) {
    const rest = line.slice(weekOnMatch[0].length)
    const date = parseSimpleDate(rest, now)
    if (date) {
      const weekNumber = getWeekNumber(date)
      return {
        lineResult: {
          value: String(weekNumber),
          error: null,
          type: 'number',
          numericValue: weekNumber,
        },
        rawResult: weekNumber,
      }
    }
  }

  // "days in MONTH YEAR" / "days in February 2020"
  const daysInMonthMatch = lower.match(/^days in ([a-z]+)(?:\s+(\d{4}))?$/)
  if (daysInMonthMatch) {
    const month = MONTH_NAME_TO_INDEX[daysInMonthMatch[1]]
    if (month) {
      const year = daysInMonthMatch[2]
        ? Number(daysInMonthMatch[2])
        : now.getFullYear()
      const daysInMonth = new Date(year, month, 0).getDate()
      return {
        lineResult: {
          value: `${daysInMonth} days`,
          error: null,
          type: 'number',
          numericValue: daysInMonth,
        },
        rawResult: daysInMonth,
      }
    }
  }

  // "days in Q1/Q2/Q3/Q4"
  const daysInQMatch = lower.match(/^days in q([1-4])(?:\s+(\d{4}))?$/)
  if (daysInQMatch) {
    const quarter = Number(daysInQMatch[1])
    const year = daysInQMatch[2] ? Number(daysInQMatch[2]) : now.getFullYear()
    const startMonth = (quarter - 1) * 3
    let total = 0
    for (let i = 0; i < 3; i++) {
      total += new Date(year, startMonth + i + 1, 0).getDate()
    }
    return {
      lineResult: {
        value: `${total} days`,
        error: null,
        type: 'number',
        numericValue: total,
      },
      rawResult: total,
    }
  }

  // "X after/before DATE"
  const offsetMatch = lower.match(
    /^(\d+)\s+(days?|weeks?|months?|years?)\s+(after|before)\s/,
  )
  if (offsetMatch) {
    const amount = Number(offsetMatch[1])
    const unit = parseTimeUnit(offsetMatch[2])
    const direction = offsetMatch[3] === 'after' ? 1 : -1
    const rest = line.slice(offsetMatch[0].length)
    const date = parseSimpleDate(rest, now)
    if (date) {
      applyDateOffset(date, amount, unit, direction)
      return {
        lineResult: {
          value: formatMathDate(date, locale),
          error: null,
          type: 'date',
        },
        rawResult: date,
      }
    }
  }

  // "current timestamp"
  if (lower === 'current timestamp') {
    const ts = Math.floor(now.getTime() / 1000)
    return {
      lineResult: {
        value: String(ts),
        error: null,
        type: 'number',
        numericValue: ts,
      },
      rawResult: ts,
    }
  }

  return null
}
