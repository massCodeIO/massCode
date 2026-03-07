import type {
  CssContext,
  LineResult,
  SpecialLineResult,
} from './math-engine/types'
import {
  DEFAULT_CURRENCY_RATES,
  DEFAULT_EM_IN_PX,
  DEFAULT_PPI,
  HUMANIZED_UNIT_NAMES,
} from './math-engine/constants'
import { evaluateCssLine } from './math-engine/css'
import { createMathInstance } from './math-engine/mathInstance'
import { preprocessMathExpression } from './math-engine/preprocess'
import {
  evaluateTimeZoneDifferenceLine,
  evaluateTimeZoneLine,
} from './math-engine/timeZones'

export type { LineResult } from './math-engine/types'

interface FormatDirective {
  format: 'hex' | 'bin' | 'oct' | 'sci' | null
  expression: string
}

let activeCurrencyRates = { ...DEFAULT_CURRENCY_RATES }
let math = createMathInstance(activeCurrencyRates)

function detectFormatDirective(line: string): FormatDirective {
  const formatMap: Record<string, 'hex' | 'bin' | 'oct' | 'sci'> = {
    'in hex': 'hex',
    'in bin': 'bin',
    'in oct': 'oct',
    'in sci': 'sci',
    'in scientific': 'sci',
  }
  const lower = line.toLowerCase()

  for (const [suffix, format] of Object.entries(formatMap)) {
    if (lower.endsWith(suffix)) {
      return {
        format,
        expression: line.slice(0, line.length - suffix.length).trim(),
      }
    }
  }

  return { format: null, expression: line }
}

function applyFormat(
  result: any,
  format: NonNullable<FormatDirective['format']>,
): LineResult {
  const num
    = typeof result === 'number'
      ? result
      : result
        && typeof result === 'object'
        && typeof result.toNumber === 'function'
        ? result.toNumber()
        : Number(result)

  if (Number.isNaN(num)) {
    return { value: String(result), error: null, type: 'number' }
  }

  const intValue = Math.round(num)

  switch (format) {
    case 'hex':
      return {
        value: `0x${intValue.toString(16).toUpperCase()}`,
        error: null,
        type: 'number',
      }
    case 'bin':
      return {
        value: `0b${intValue.toString(2)}`,
        error: null,
        type: 'number',
      }
    case 'oct':
      return {
        value: `0o${intValue.toString(8)}`,
        error: null,
        type: 'number',
      }
    case 'sci':
      return { value: num.toExponential(), error: null, type: 'number' }
  }
}

function humanizeFormattedUnits(value: string) {
  return value.replace(
    /(-?\d[\d,]*(?:\.\d+)?)\s+([a-z][a-z0-9]*)\b/gi,
    (match, amountText: string, unitId: string) => {
      const displayUnit = HUMANIZED_UNIT_NAMES[unitId]
      if (!displayUnit) {
        return match
      }

      const numericAmount = Number.parseFloat(amountText.replace(/,/g, ''))
      const unitLabel
        = Math.abs(numericAmount) === 1
          ? displayUnit.singular
          : displayUnit.plural

      return `${amountText} ${unitLabel}`
    },
  )
}

function formatResult(result: any): LineResult {
  if (result === undefined || result === null) {
    return { value: null, error: null, type: 'empty' }
  }

  if (result instanceof Date) {
    return {
      value: result.toLocaleString(),
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
    return {
      value: humanizeFormattedUnits(math.format(result, { precision: 6 })),
      error: null,
      type: 'unit',
    }
  }

  if (typeof result === 'number') {
    const formatted = Number.isInteger(result)
      ? result.toLocaleString('en-US')
      : result.toLocaleString('en-US', { maximumFractionDigits: 6 })

    return { value: formatted, error: null, type: 'number' }
  }

  if (typeof result === 'string') {
    return { value: result, error: null, type: 'number' }
  }

  if (result && typeof result.toString === 'function') {
    return {
      value: humanizeFormattedUnits(math.format(result, { precision: 6 })),
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

function splitTopLevelAddSub(expression: string) {
  const terms: string[] = []
  const operators: Array<'+' | '-'> = []
  let depth = 0
  let segmentStart = 0

  for (let index = 0; index < expression.length; index++) {
    const char = expression[index]

    if (char === '(') {
      depth += 1
      continue
    }

    if (char === ')') {
      depth = Math.max(0, depth - 1)
      continue
    }

    if (depth !== 0 || (char !== '+' && char !== '-')) {
      continue
    }

    let prevIndex = index - 1
    while (prevIndex >= 0 && /\s/.test(expression[prevIndex])) {
      prevIndex -= 1
    }

    let nextIndex = index + 1
    while (nextIndex < expression.length && /\s/.test(expression[nextIndex])) {
      nextIndex += 1
    }

    if (prevIndex < 0 || nextIndex >= expression.length) {
      continue
    }

    if ('+-*/%^,('.includes(expression[prevIndex])) {
      continue
    }

    terms.push(expression.slice(segmentStart, index).trim())
    operators.push(char)
    segmentStart = index + 1
  }

  if (operators.length === 0) {
    return null
  }

  terms.push(expression.slice(segmentStart).trim())

  if (terms.some(term => !term)) {
    return null
  }

  return { terms, operators }
}

function evaluateDateLikeExpression(
  expression: string,
  now: Date,
  scope: Record<string, any>,
) {
  const timeZoneResult = evaluateTimeZoneLine(expression, now)
  if (timeZoneResult?.rawResult instanceof Date) {
    return timeZoneResult.rawResult
  }

  try {
    const result = math.evaluate(expression, scope)
    return result instanceof Date ? result : null
  }
  catch {
    return null
  }
}

function evaluateDurationMilliseconds(
  expression: string,
  scope: Record<string, any>,
) {
  try {
    const result = math.evaluate(expression, scope)
    if (
      result
      && typeof result === 'object'
      && typeof result.toNumber === 'function'
    ) {
      const milliseconds = result.toNumber('ms')
      return Number.isFinite(milliseconds) ? milliseconds : null
    }
  }
  catch {
    return null
  }

  return null
}

function evaluateDateArithmeticLine(
  line: string,
  now: Date,
  scope: Record<string, any>,
): SpecialLineResult | null {
  const split = splitTopLevelAddSub(line)
  if (!split) {
    return null
  }

  const initialDate = evaluateDateLikeExpression(split.terms[0], now, scope)
  const initialDuration = initialDate
    ? null
    : evaluateDurationMilliseconds(split.terms[0], scope)

  if (!initialDate && initialDuration === null) {
    return null
  }

  let currentDate = initialDate ? new Date(initialDate.getTime()) : null
  let currentDuration = initialDuration

  for (let index = 0; index < split.operators.length; index++) {
    const operator = split.operators[index]
    const term = split.terms[index + 1]
    const nextDate = evaluateDateLikeExpression(term, now, scope)
    const nextDuration = nextDate
      ? null
      : evaluateDurationMilliseconds(term, scope)

    if (currentDate) {
      if (nextDuration === null) {
        return null
      }

      currentDate = new Date(
        currentDate.getTime()
        + (operator === '+' ? nextDuration : -nextDuration),
      )
      continue
    }

    if (nextDate) {
      if (operator !== '+' || currentDuration === null) {
        return null
      }

      currentDate = new Date(nextDate.getTime() + currentDuration)
      currentDuration = null
      continue
    }

    if (currentDuration === null || nextDuration === null) {
      return null
    }

    currentDuration
      = operator === '+'
        ? currentDuration + nextDuration
        : currentDuration - nextDuration
  }

  if (!currentDate) {
    return null
  }

  return {
    lineResult: formatResult(currentDate),
    rawResult: currentDate,
  }
}

export function useMathEngine() {
  function evaluateDocument(text: string): LineResult[] {
    const lines = text.split('\n')
    const results: LineResult[] = []
    const scope: Record<string, any> = {
      em: DEFAULT_EM_IN_PX,
      ppi: DEFAULT_PPI,
    }
    const cssContext: CssContext = {
      emPx: DEFAULT_EM_IN_PX,
      ppi: DEFAULT_PPI,
    }
    const currentDate = new Date()

    let prevResult: any
    let numericBlock: number[] = []

    for (const line of lines) {
      const trimmed = line.trim()

      if (!trimmed) {
        results.push({ value: null, error: null, type: 'empty' })
        prevResult = undefined
        numericBlock = []
        continue
      }

      if (trimmed.startsWith('//') || trimmed.startsWith('#')) {
        results.push({ value: null, error: null, type: 'comment' })
        continue
      }

      if (prevResult !== undefined) {
        scope.prev = prevResult
      }

      const lowerTrimmed = trimmed.toLowerCase()
      if (lowerTrimmed === 'sum' || lowerTrimmed === 'total') {
        const total = numericBlock.reduce((sum, value) => sum + value, 0)
        const formatted = formatResult(total)
        formatted.type = 'aggregate'
        results.push(formatted)
        prevResult = total
        numericBlock.push(total)
        continue
      }

      if (lowerTrimmed === 'average' || lowerTrimmed === 'avg') {
        const total = numericBlock.reduce((sum, value) => sum + value, 0)
        const average
          = numericBlock.length > 0 ? total / numericBlock.length : 0
        const formatted = formatResult(average)
        formatted.type = 'aggregate'
        results.push(formatted)
        prevResult = average
        numericBlock.push(average)
        continue
      }

      try {
        const timeZoneDifferenceResult = evaluateTimeZoneDifferenceLine(
          trimmed,
          currentDate,
          {
            createHourUnit: hours => math.unit(hours, 'hour'),
            formatResult,
          },
        )
        if (timeZoneDifferenceResult) {
          results.push(timeZoneDifferenceResult.lineResult)
          prevResult = timeZoneDifferenceResult.rawResult
          const numericValue = getNumericValue(
            timeZoneDifferenceResult.rawResult,
          )
          if (numericValue !== null) {
            numericBlock.push(numericValue)
          }
          continue
        }

        const timeZoneResult = evaluateTimeZoneLine(trimmed, currentDate)
        if (timeZoneResult) {
          results.push(timeZoneResult.lineResult)
          prevResult = timeZoneResult.rawResult
          continue
        }

        const cssResult = evaluateCssLine(trimmed, cssContext)
        if (cssResult) {
          scope.em = cssContext.emPx
          scope.ppi = cssContext.ppi
          results.push(cssResult.lineResult)
          prevResult = cssResult.rawResult
          if (typeof cssResult.rawResult === 'number') {
            numericBlock.push(cssResult.rawResult)
          }
          continue
        }

        const processed = preprocessMathExpression(trimmed)
        const dateArithmeticResult = evaluateDateArithmeticLine(
          processed,
          currentDate,
          scope,
        )
        if (dateArithmeticResult) {
          results.push(dateArithmeticResult.lineResult)
          prevResult = dateArithmeticResult.rawResult
          continue
        }

        const { format, expression } = detectFormatDirective(processed)
        const toEvaluate = format ? expression : processed
        const result = math.evaluate(toEvaluate, scope)

        if (result === undefined) {
          results.push({ value: null, error: null, type: 'empty' })
          prevResult = undefined
          continue
        }

        if (format) {
          const formatted = applyFormat(result, format)
          results.push(formatted)
          prevResult = result
          const numericValue = getNumericValue(result)
          if (numericValue !== null) {
            numericBlock.push(numericValue)
          }
          continue
        }

        const formatted = formatResult(result)
        if (
          /^[a-z_]\w*\s*=/i.test(trimmed)
          && !/^[a-z_]\w*\s*==/i.test(trimmed)
        ) {
          formatted.type = 'assignment'
        }

        results.push(formatted)
        prevResult = result
        const numericValue = getNumericValue(result)
        if (numericValue !== null) {
          numericBlock.push(numericValue)
        }
      }
      catch (error: any) {
        results.push({
          value: null,
          error: error.message || 'Error',
          type: 'empty',
        })
        prevResult = undefined
      }
    }

    return results
  }

  function updateCurrencyRates(rates: Record<string, number>) {
    activeCurrencyRates = {
      ...activeCurrencyRates,
      ...rates,
    }
    math = createMathInstance(activeCurrencyRates)
  }

  return {
    evaluateDocument,
    updateCurrencyRates,
  }
}
