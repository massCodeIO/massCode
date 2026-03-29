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

function parseClockToMinutes(text: string): number | null {
  const m = text.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i)
  if (!m)
    return null
  let hours = Number(m[1])
  const minutes = Number(m[2] || '0')
  const meridiem = m[3]?.toLowerCase()
  if (meridiem === 'pm' && hours < 12)
    hours += 12
  if (meridiem === 'am' && hours === 12)
    hours = 0
  if (hours > 23 || minutes > 59)
    return null
  return hours * 60 + minutes
}

function isWeekday(date: Date): boolean {
  const day = date.getDay()
  return day !== 0 && day !== 6
}

function countWorkdays(start: Date, end: Date): number {
  let count = 0
  const d = new Date(start)
  const direction = end >= start ? 1 : -1
  const target = end.getTime()

  if (direction === 1) {
    while (d.getTime() < target) {
      if (isWeekday(d))
        count++
      d.setDate(d.getDate() + 1)
    }
  }
  else {
    while (d.getTime() > target) {
      d.setDate(d.getDate() - 1)
      if (isWeekday(d))
        count++
    }
  }

  return count
}

function addWorkdays(date: Date, n: number): Date {
  const result = new Date(date)
  let remaining = Math.abs(n)
  const direction = n >= 0 ? 1 : -1

  while (remaining > 0) {
    result.setDate(result.getDate() + direction)
    if (isWeekday(result))
      remaining--
  }

  return result
}

function workdaysResult(count: number): CalendarResult {
  const abs = Math.abs(count)
  return {
    lineResult: {
      value: `${abs} ${abs === 1 ? 'workday' : 'workdays'}`,
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

  // "workdays in 3 weeks"
  const workdaysInMatch = lower.match(
    /^workdays\s+in\s+(\d+)\s+(weeks?|months?|years?)$/,
  )
  if (workdaysInMatch) {
    const amount = Number(workdaysInMatch[1])
    const unit = parseTimeUnit(workdaysInMatch[2])
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const end = new Date(start)
    applyDateOffset(end, amount, unit, 1)
    return workdaysResult(countWorkdays(start, end))
  }

  // "workdays from DATE to DATE"
  const workdaysFromMatch = lower.match(/^workdays\s+from\s/)
  if (workdaysFromMatch) {
    const rest = line.slice(workdaysFromMatch[0].length)
    const toIdx = rest.toLowerCase().lastIndexOf(' to ')
    if (toIdx > 0) {
      const d1 = parseSimpleDate(rest.slice(0, toIdx), now)
      const d2 = parseSimpleDate(rest.slice(toIdx + 4), now)
      if (d1 && d2)
        return workdaysResult(countWorkdays(d1, d2))
    }
  }

  // "DATE to DATE in workdays"
  const inWorkdaysMatch = lower.match(/\s+in\s+workdays$/)
  if (inWorkdaysMatch) {
    const expr = line.slice(0, inWorkdaysMatch.index!).trim()
    const toIdx = expr.toLowerCase().lastIndexOf(' to ')
    if (toIdx > 0) {
      const d1 = parseSimpleDate(expr.slice(0, toIdx), now)
      const d2 = parseSimpleDate(expr.slice(toIdx + 4), now)
      if (d1 && d2)
        return workdaysResult(countWorkdays(d1, d2))
    }
  }

  // "DATE + N workdays"
  const addWorkdaysMatch = lower.match(/^(\d+)\s+workdays?\s+(after|before)\s/)
  if (addWorkdaysMatch) {
    const amount = Number(addWorkdaysMatch[1])
    const direction = addWorkdaysMatch[2] === 'after' ? 1 : -1
    const rest = line.slice(addWorkdaysMatch[0].length)
    const date = parseSimpleDate(rest, now)
    if (date) {
      const result = addWorkdays(date, amount * direction)
      return {
        lineResult: {
          value: formatMathDate(result, locale),
          error: null,
          type: 'date',
        },
        rawResult: result,
      }
    }
  }

  // "time1 to time2" → interval (e.g. "7:30 to 20:45", "4pm to 3am")
  const clockIntervalMatch = lower.match(
    /^(\d{1,2}(?::\d{2})?\s?(?:am|pm)?)\s+to\s+(\d{1,2}(?::\d{2})?\s?(?:am|pm)?)$/i,
  )
  if (clockIntervalMatch) {
    const t1 = parseClockToMinutes(clockIntervalMatch[1])
    const t2 = parseClockToMinutes(clockIntervalMatch[2])
    if (t1 !== null && t2 !== null) {
      let diff = t2 - t1
      if (diff < 0)
        diff += 24 * 60
      const hours = Math.floor(diff / 60)
      const minutes = diff % 60
      const parts: string[] = []
      if (hours)
        parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`)
      if (minutes)
        parts.push(`${minutes} min`)
      const value = parts.join(' ') || '0 min'
      return {
        lineResult: { value, error: null, type: 'number', numericValue: diff },
        rawResult: diff,
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

  // "DATE to timestamp"
  const toTimestampMatch = lower.match(/\s+to\s+timestamp$/)
  if (toTimestampMatch) {
    const dateStr = line.slice(0, toTimestampMatch.index!).trim()
    const date = parseSimpleDate(dateStr, now)
    if (date) {
      const ts = Math.floor(date.getTime() / 1000)
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
  }

  // "DATE as iso8601" / "DATE to iso8601"
  const iso8601Match = lower.match(/\s+(?:as|to)\s+iso8601$/)
  if (iso8601Match) {
    const dateStr = line.slice(0, iso8601Match.index!).trim()
    const date = parseSimpleDate(dateStr, now)
    if (date) {
      const iso = date.toISOString()
      return {
        lineResult: { value: iso, error: null, type: 'number' },
        rawResult: iso,
      }
    }
  }

  // "ISO_STRING to date" (e.g. "2019-04-01T15:30:00 to date")
  const isoToDateMatch = lower.match(
    /^(\d{4}-\d{2}-\d{2}t[\d:.]+)\s+to\s+date$/,
  )
  if (isoToDateMatch) {
    const date = new Date(isoToDateMatch[1])
    if (!Number.isNaN(date.getTime())) {
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

  // "LARGE_NUMBER to date" (millisecond timestamp, > 1e12)
  const msTimestampMatch = lower.match(/^(\d{13,})\s+to\s+date$/)
  if (msTimestampMatch) {
    const ms = Number(msTimestampMatch[1])
    const date = new Date(ms)
    if (!Number.isNaN(date.getTime())) {
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

  return null
}
