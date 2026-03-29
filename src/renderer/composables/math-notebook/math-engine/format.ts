export function formatMathNumber(
  value: number,
  locale: string,
  decimalPlaces: number,
): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimalPlaces,
  }).format(value)
}

export type DateFormatStyle = 'numeric' | 'short' | 'long'

const MONTH_STYLE: Record<DateFormatStyle, 'numeric' | 'short' | 'long'> = {
  numeric: 'numeric',
  short: 'short',
  long: 'long',
}

export interface DateFormatOptions {
  timeZone?: string
  timeZoneName?: boolean
  dateOnly?: boolean
}

export function formatMathDate(
  date: Date,
  locale: string,
  dateFormat: DateFormatStyle = 'numeric',
  options: DateFormatOptions = {},
): string {
  const formatOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: MONTH_STYLE[dateFormat],
    day: 'numeric',
  }

  if (!options.dateOnly) {
    formatOptions.hour = 'numeric'
    formatOptions.minute = '2-digit'
  }

  if (options.timeZone) {
    formatOptions.timeZone = options.timeZone
  }

  if (options.timeZoneName) {
    formatOptions.timeZoneName = 'short'
  }

  return new Intl.DateTimeFormat(locale, formatOptions).format(date)
}
