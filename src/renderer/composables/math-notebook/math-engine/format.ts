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

export function formatMathDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale).format(date)
}
