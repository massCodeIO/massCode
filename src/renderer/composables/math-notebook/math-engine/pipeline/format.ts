import type { DateFormatStyle } from '../format'
import type { LineClassification, LineResult } from '../types'
import { HUMANIZED_UNIT_NAMES, SUPPORTED_CURRENCY_CODES } from '../constants'
import { formatMathDate, formatMathNumber } from '../format'
import { coerceToNumber, toFraction } from '../utils'

function formatTimespan(totalSeconds: number): string {
  const abs = Math.abs(totalSeconds)
  const weeks = Math.floor(abs / 604800)
  const days = Math.floor((abs % 604800) / 86400)
  const hours = Math.floor((abs % 86400) / 3600)
  const minutes = Math.floor((abs % 3600) / 60)
  const seconds = Math.round(abs % 60)

  const parts: string[] = []
  if (weeks)
    parts.push(`${weeks} ${weeks === 1 ? 'week' : 'weeks'}`)
  if (days)
    parts.push(`${days} ${days === 1 ? 'day' : 'days'}`)
  if (hours)
    parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`)
  if (minutes)
    parts.push(`${minutes} min`)
  if (seconds || parts.length === 0)
    parts.push(`${seconds} s`)
  return parts.join(' ')
}

function formatLaptime(totalSeconds: number): string {
  const abs = Math.abs(totalSeconds)
  const h = Math.floor(abs / 3600)
  const m = Math.floor((abs % 3600) / 60)
  const s = Math.floor(abs % 60)
  const ms = Math.round((abs % 1) * 1000)

  const hh = String(h).padStart(2, '0')
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')

  if (ms > 0) {
    return `${hh}:${mm}:${ss}.${String(ms).padStart(3, '0')}`
  }
  return `${hh}:${mm}:${ss}`
}

interface MathFormatterInstance {
  format: (value: any, options: { precision: number }) => string
  unit: (value: number, unit: string) => any
}

interface CreateLineFormatterOptions {
  math: MathFormatterInstance
  locale: string
  decimalPlaces: number
  dateFormat: DateFormatStyle
}

export function createLineFormatter(options: CreateLineFormatterOptions) {
  const { math, locale, decimalPlaces, dateFormat } = options

  function humanizeUnitToken(unitId: string) {
    const displayUnit = HUMANIZED_UNIT_NAMES[unitId]
    return displayUnit ? displayUnit.plural : unitId
  }

  function humanizeFormattedUnits(value: string) {
    let result = value.replace(
      /(-?\d[\d,]*(?:\.\d+)?)\s+([a-z][a-z0-9]*)\b/gi,
      (match, amountText: string, unitId: string) => {
        const numericAmount = Number.parseFloat(amountText.replace(/,/g, ''))
        if (Number.isNaN(numericAmount))
          return match

        const formattedAmount = formatMathNumber(
          numericAmount,
          locale,
          decimalPlaces,
        )
        const displayUnit = HUMANIZED_UNIT_NAMES[unitId]
        if (!displayUnit)
          return `${formattedAmount} ${unitId}`

        const unitLabel
          = Math.abs(numericAmount) === 1
            ? displayUnit.singular
            : displayUnit.plural

        return `${formattedAmount} ${unitLabel}`
      },
    )

    result = result.replace(
      /\b(mc(?:second|minute|hour|day|week|month|year))\b/g,
      (_, unitId: string) => humanizeUnitToken(unitId),
    )

    return result
  }

  function formatResult(result: any, overridePrecision?: number): LineResult {
    const effectivePrecision = overridePrecision ?? decimalPlaces
    if (result === undefined || result === null) {
      return { value: null, error: null, type: 'empty' }
    }

    if (typeof result === 'boolean') {
      return { value: String(result), error: null, type: 'number' }
    }

    if (result instanceof Date) {
      return {
        value: formatMathDate(result, locale, dateFormat),
        error: null,
        type: 'date',
      }
    }

    if (
      result
      && typeof result === 'object'
      && typeof result.toNumber === 'function'
      && result.units
    ) {
      if (Array.isArray(result.units) && result.units.length === 2) {
        const units = result.units as Array<{
          unit: { name: string, value: number, base?: { key?: string } }
          prefix: { value: number }
          power: number
        }>
        const currencyUnit = units.find(
          u =>
            u.unit.base?.key?.includes('STUFF')
            || SUPPORTED_CURRENCY_CODES.includes(u.unit.name),
        )
        const timeUnit = units.find(u => u.unit.base?.key === 'TIME')
        if (
          currencyUnit
          && timeUnit
          && currencyUnit.power === 1
          && timeUnit.power === 1
        ) {
          try {
            const rawValue = result.value as number
            const currencyScale
              = currencyUnit.unit.value * currencyUnit.prefix.value
            const timeScale = timeUnit.unit.value * timeUnit.prefix.value
            const currencyAmount
              = (rawValue / (currencyScale * timeScale)) * currencyScale
            const simplified = math.unit(
              currencyAmount,
              currencyUnit.unit.name,
            )
            return {
              value: humanizeFormattedUnits(
                math.format(simplified, {
                  notation: 'fixed',
                  precision: decimalPlaces,
                }),
              ),
              error: null,
              type: 'unit',
            }
          }
          catch {
            // Fall through to default unit formatting.
          }
        }
      }

      let unitNumericValue: number | undefined
      try {
        unitNumericValue = result.toNumber()
      }
      catch {
        /* compound units may not convert */
      }

      return {
        value: humanizeFormattedUnits(
          math.format(result, {
            notation: 'fixed',
            precision: effectivePrecision,
          }),
        ),
        error: null,
        type: 'unit',
        ...(unitNumericValue !== undefined
          ? { numericValue: unitNumericValue }
          : {}),
      }
    }

    if (typeof result === 'number') {
      return {
        value: formatMathNumber(result, locale, effectivePrecision),
        error: null,
        type: 'number',
        ...(Number.isFinite(result) ? { numericValue: result } : {}),
      }
    }

    if (typeof result === 'string') {
      return { value: result, error: null, type: 'number' }
    }

    if (result && typeof result.toString === 'function') {
      return {
        value: humanizeFormattedUnits(
          math.format(result, {
            notation: 'fixed',
            precision: effectivePrecision,
          }),
        ),
        error: null,
        type: 'number',
      }
    }

    return { value: String(result), error: null, type: 'number' }
  }

  function getNumericValue(result: any): number | null {
    if (typeof result === 'number')
      return result

    if (
      result
      && typeof result === 'object'
      && typeof result.toNumber === 'function'
    ) {
      try {
        return result.toNumber()
      }
      catch {
        return null
      }
    }

    return null
  }

  function applyRoundingModifier(
    value: number,
    rounding: NonNullable<LineClassification['modifiers']['rounding']>,
  ): number {
    switch (rounding.type) {
      case 'dp': {
        const factor = 10 ** rounding.param
        return Math.round(value * factor) / factor
      }
      case 'round':
        return Math.round(value)
      case 'ceil':
        return Math.ceil(value)
      case 'floor':
        return Math.floor(value)
      case 'nearest':
        return Math.round(value / rounding.param) * rounding.param
      case 'nearestCeil':
        return Math.ceil(value / rounding.param) * rounding.param
      case 'nearestFloor':
        return Math.floor(value / rounding.param) * rounding.param
      default:
        return value
    }
  }

  function applyResultFormat(
    result: any,
    format: NonNullable<LineClassification['modifiers']['resultFormat']>,
  ): LineResult {
    const num = coerceToNumber(result)
    if (Number.isNaN(num))
      return { value: String(result), error: null, type: 'number' }

    if (format === 'multiplier') {
      return {
        value: `${formatMathNumber(num, locale, decimalPlaces)}x`,
        error: null,
        type: 'number',
        numericValue: num,
      }
    }

    const intValue = Math.round(num)
    switch (format) {
      case 'hex':
        return {
          value: `0x${intValue.toString(16).toUpperCase()}`,
          error: null,
          type: 'number',
          numericValue: intValue,
        }
      case 'bin':
        return {
          value: `0b${intValue.toString(2)}`,
          error: null,
          type: 'number',
          numericValue: intValue,
        }
      case 'oct':
        return {
          value: `0o${intValue.toString(8)}`,
          error: null,
          type: 'number',
          numericValue: intValue,
        }
      case 'sci':
        return {
          value: num.toExponential(),
          error: null,
          type: 'number',
          numericValue: num,
        }
    }
  }

  function applyStripUnit(
    result: any,
    strip: NonNullable<LineClassification['modifiers']['stripUnit']>,
  ): LineResult {
    const num = coerceToNumber(result)
    if (Number.isNaN(num))
      return { value: String(result), error: null, type: 'number' }

    if (strip === 'fraction') {
      return {
        value: toFraction(num),
        error: null,
        type: 'number',
        numericValue: num,
      }
    }

    if (strip === 'timespan' || strip === 'laptime') {
      // Convert unit result to seconds
      let seconds = num
      if (
        result
        && typeof result === 'object'
        && typeof result.toNumber === 'function'
      ) {
        try {
          seconds = result.toNumber('s')
        }
        catch {
          /* use coerced num */
        }
      }
      const formatter = strip === 'timespan' ? formatTimespan : formatLaptime
      return { value: formatter(seconds), error: null, type: 'number' }
    }

    return {
      value: formatMathNumber(num, locale, decimalPlaces),
      error: null,
      type: 'number',
      numericValue: num,
    }
  }

  return {
    applyResultFormat,
    applyRoundingModifier,
    applyStripUnit,
    formatResult,
    getNumericValue,
  }
}

export type LineFormatter = ReturnType<typeof createLineFormatter>
