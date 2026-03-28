import type {
  CssContext,
  CurrencyServiceState,
  LineResult,
  SpecialLineResult,
} from './math-engine/types'
import {
  DEFAULT_EM_IN_PX,
  DEFAULT_PPI,
  HUMANIZED_UNIT_NAMES,
} from './math-engine/constants'
import { evaluateCssLine } from './math-engine/css'
import { formatMathDate, formatMathNumber } from './math-engine/format'
import { createMathInstance } from './math-engine/mathInstance'
import {
  hasCurrencyExpression,
  preprocessMathExpression,
} from './math-engine/preprocess'
import {
  evaluateTimeZoneDifferenceLine,
  evaluateTimeZoneLine,
  parseExplicitLocalTemporalExpression,
} from './math-engine/timeZones'

export type { LineResult } from './math-engine/types'

interface FormatDirective {
  format: 'hex' | 'bin' | 'oct' | 'sci' | 'number' | 'dec' | null
  expression: string
}

interface RoundingDirective {
  type:
    | 'dp'
    | 'round'
    | 'ceil'
    | 'floor'
    | 'nearest'
    | 'nearestCeil'
    | 'nearestFloor'
    | null
  param: number
  expression: string
}

const NEAREST_WORDS: Record<string, number> = {
  ten: 10,
  hundred: 100,
  thousand: 1000,
  million: 1000000,
}

function detectRoundingDirective(line: string): RoundingDirective {
  const lower = line.toLowerCase()
  let m: RegExpMatchArray | null

  // "to N dp" / "to N digits"
  m = lower.match(/\s+to\s+(\d+)\s+(?:dp|digits?)$/)
  if (m) {
    return {
      type: 'dp',
      param: Number(m[1]),
      expression: line.slice(0, m.index!).trim(),
    }
  }

  // "rounded up to nearest X" / "rounded down to nearest X"
  m = lower.match(/\s+rounded\s+(up|down)\s+to\s+nearest\s+(\w+)$/)
  if (m) {
    const n = NEAREST_WORDS[m[2]] || Number(m[2])
    if (n > 0) {
      return {
        type: m[1] === 'up' ? 'nearestCeil' : 'nearestFloor',
        param: n,
        expression: line.slice(0, m.index!).trim(),
      }
    }
  }

  // "rounded to nearest X" / "to nearest X"
  m = lower.match(/\s+(?:rounded\s+)?to\s+nearest\s+(\w+)$/)
  if (m) {
    const n = NEAREST_WORDS[m[1]] || Number(m[1])
    if (n > 0) {
      return {
        type: 'nearest',
        param: n,
        expression: line.slice(0, m.index!).trim(),
      }
    }
  }

  // "rounded up" / "rounded down"
  m = lower.match(/\s+rounded\s+(up|down)$/)
  if (m) {
    return {
      type: m[1] === 'up' ? 'ceil' : 'floor',
      param: 0,
      expression: line.slice(0, m.index!).trim(),
    }
  }

  // "rounded"
  m = lower.match(/\s+rounded$/)
  if (m) {
    return {
      type: 'round',
      param: 0,
      expression: line.slice(0, m.index!).trim(),
    }
  }

  return { type: null, param: 0, expression: line }
}

function applyRounding(value: number, directive: RoundingDirective): number {
  switch (directive.type) {
    case 'dp': {
      const factor = 10 ** directive.param
      return Math.round(value * factor) / factor
    }
    case 'round':
      return Math.round(value)
    case 'ceil':
      return Math.ceil(value)
    case 'floor':
      return Math.floor(value)
    case 'nearest':
      return Math.round(value / directive.param) * directive.param
    case 'nearestCeil':
      return Math.ceil(value / directive.param) * directive.param
    case 'nearestFloor':
      return Math.floor(value / directive.param) * directive.param
    default:
      return value
  }
}

let activeCurrencyRates: Record<string, number> = {}
let currencyServiceState: CurrencyServiceState = 'loading'
let currencyUnavailableMessage = ''
let math = createMathInstance(activeCurrencyRates)

let activeLocale = 'en-US'
let activeDecimalPlaces = 6

const STRIP_UNIT_SUFFIXES: Record<string, 'number' | 'dec'> = {
  'as number': 'number',
  'to number': 'number',
  'as decimal': 'dec',
  'to decimal': 'dec',
  'as dec': 'dec',
  'to dec': 'dec',
}

function detectStripUnitDirective(line: string): FormatDirective {
  const lower = line.toLowerCase()
  for (const [suffix, format] of Object.entries(STRIP_UNIT_SUFFIXES)) {
    if (lower.endsWith(suffix)) {
      return {
        format,
        expression: line.slice(0, line.length - suffix.length).trim(),
      }
    }
  }
  return { format: null, expression: line }
}

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
  if (format === 'number' || format === 'dec') {
    let num: number
    if (typeof result === 'number') {
      num = result
    }
    else if (
      result
      && typeof result === 'object'
      && typeof result.toNumber === 'function'
    ) {
      try {
        num = result.toNumber()
      }
      catch {
        num = Number.NaN
      }
    }
    else {
      num = Number(result)
    }

    if (Number.isNaN(num)) {
      return { value: String(result), error: null, type: 'number' }
    }

    return {
      value: formatMathNumber(num, activeLocale, activeDecimalPlaces),
      error: null,
      type: 'number',
      numericValue: num,
    }
  }

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

function humanizeFormattedUnits(value: string) {
  return value.replace(
    /(-?\d[\d,]*(?:\.\d+)?)\s+([a-z][a-z0-9]*)\b/gi,
    (match, amountText: string, unitId: string) => {
      const numericAmount = Number.parseFloat(amountText.replace(/,/g, ''))
      if (Number.isNaN(numericAmount))
        return match

      const formattedAmount = formatMathNumber(
        numericAmount,
        activeLocale,
        activeDecimalPlaces,
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
}

function formatResult(result: any): LineResult {
  if (result === undefined || result === null) {
    return { value: null, error: null, type: 'empty' }
  }

  if (result instanceof Date) {
    return {
      value: formatMathDate(result, activeLocale),
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
      value: humanizeFormattedUnits(
        math.format(result, { precision: activeDecimalPlaces }),
      ),
      error: null,
      type: 'unit',
    }
  }

  if (typeof result === 'number') {
    if (!Number.isFinite(result)) {
      return {
        value: formatMathNumber(result, activeLocale, activeDecimalPlaces),
        error: null,
        type: 'number',
      }
    }

    return {
      value: formatMathNumber(result, activeLocale, activeDecimalPlaces),
      error: null,
      type: 'number',
      numericValue: result,
    }
  }

  if (typeof result === 'string') {
    return { value: result, error: null, type: 'number' }
  }

  if (result && typeof result.toString === 'function') {
    return {
      value: humanizeFormattedUnits(
        math.format(result, { precision: activeDecimalPlaces }),
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

  const localTemporalResult = parseExplicitLocalTemporalExpression(
    expression,
    now,
  )
  if (localTemporalResult) {
    return localTemporalResult.date
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

function evaluateDateAssignmentLine(
  line: string,
  now: Date,
  scope: Record<string, any>,
): SpecialLineResult | null {
  const assignmentIndex = line.indexOf('=')
  if (assignmentIndex <= 0) {
    return null
  }

  const variableName = line.slice(0, assignmentIndex).trim()
  if (!/^[a-z_]\w*$/i.test(variableName)) {
    return null
  }

  const expression = line.slice(assignmentIndex + 1).trim()
  if (!expression) {
    return null
  }

  const dateValue = evaluateDateLikeExpression(expression, now, scope)

  if (!dateValue) {
    return null
  }

  scope[variableName] = dateValue

  return {
    lineResult: {
      ...formatResult(dateValue),
      type: 'assignment',
    },
    rawResult: dateValue,
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

      if (lowerTrimmed === 'median') {
        if (numericBlock.length > 0) {
          const sorted = [...numericBlock].sort((a, b) => a - b)
          const mid = Math.floor(sorted.length / 2)
          const median
            = sorted.length % 2 !== 0
              ? sorted[mid]
              : (sorted[mid - 1] + sorted[mid]) / 2
          const formatted = formatResult(median)
          formatted.type = 'aggregate'
          results.push(formatted)
          prevResult = median
          numericBlock.push(median)
        }
        else {
          results.push(formatResult(0))
        }
        continue
      }

      if (lowerTrimmed === 'count') {
        const count = numericBlock.length
        const formatted = formatResult(count)
        formatted.type = 'aggregate'
        results.push(formatted)
        prevResult = count
        numericBlock.push(count)
        continue
      }

      const inlineAggregateMatch = lowerTrimmed.match(
        /^(total|sum|average|avg|median|count)\s+of\s+/i,
      )
      if (inlineAggregateMatch) {
        const fn = inlineAggregateMatch[1].toLowerCase()
        const listStr = trimmed.slice(inlineAggregateMatch[0].length)
        const items = listStr
          .replace(/\band\b/gi, ',')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
          .map(Number)
          .filter(n => !Number.isNaN(n))

        if (items.length > 0) {
          let value: number
          if (fn === 'total' || fn === 'sum') {
            value = items.reduce((a, b) => a + b, 0)
          }
          else if (fn === 'average' || fn === 'avg') {
            value = items.reduce((a, b) => a + b, 0) / items.length
          }
          else if (fn === 'median') {
            const sorted = [...items].sort((a, b) => a - b)
            const mid = Math.floor(sorted.length / 2)
            value
              = sorted.length % 2 !== 0
                ? sorted[mid]
                : (sorted[mid - 1] + sorted[mid]) / 2
          }
          else {
            value = items.length
          }
          const formatted = formatResult(value)
          formatted.type = 'aggregate'
          results.push(formatted)
          prevResult = value
          numericBlock.push(value)
          continue
        }
      }

      try {
        const roundingDirective = detectRoundingDirective(trimmed)
        if (roundingDirective.type) {
          const roundProcessed = preprocessMathExpression(
            roundingDirective.expression,
          )
          const roundRaw = math.evaluate(roundProcessed, scope)
          const num = getNumericValue(roundRaw)
          if (num !== null) {
            const rounded = applyRounding(num, roundingDirective)
            const formatted = formatResult(rounded)
            results.push(formatted)
            prevResult = rounded
            numericBlock.push(rounded)
            continue
          }
        }

        const stripDirective = detectStripUnitDirective(trimmed)
        if (stripDirective.format) {
          const stripProcessed = preprocessMathExpression(
            stripDirective.expression,
          )
          const stripResult = math.evaluate(stripProcessed, scope)
          const formatted = applyFormat(stripResult, stripDirective.format)
          results.push(formatted)
          prevResult = stripResult
          const numericValue = getNumericValue(stripResult)
          if (numericValue !== null) {
            numericBlock.push(numericValue)
          }
          continue
        }

        if (
          currencyServiceState !== 'ready'
          && hasCurrencyExpression(trimmed)
        ) {
          results.push(
            currencyServiceState === 'loading'
              ? { value: null, error: null, type: 'pending' }
              : {
                  value: null,
                  error: currencyUnavailableMessage,
                  showError: true,
                  type: 'empty',
                },
          )
          prevResult = undefined
          continue
        }

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

        const dateAssignmentResult = evaluateDateAssignmentLine(
          processed,
          currentDate,
          scope,
        )
        if (dateAssignmentResult) {
          results.push(dateAssignmentResult.lineResult)
          prevResult = dateAssignmentResult.rawResult
          continue
        }

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

        const localTemporalResult = parseExplicitLocalTemporalExpression(
          processed,
          currentDate,
        )
        if (localTemporalResult) {
          results.push(formatResult(localTemporalResult.date))
          prevResult = localTemporalResult.date
          continue
        }

        const { format, expression: formatExpression }
          = detectFormatDirective(processed)
        const toEvaluate = format ? formatExpression : processed
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
    currencyServiceState = 'ready'
    currencyUnavailableMessage = ''
    activeCurrencyRates = {
      ...rates,
    }
    math = createMathInstance(activeCurrencyRates)
  }

  function setCurrencyServiceState(
    state: CurrencyServiceState,
    errorMessage = '',
  ) {
    currencyServiceState = state
    currencyUnavailableMessage = state === 'unavailable' ? errorMessage : ''

    if (state !== 'ready') {
      activeCurrencyRates = {}
      math = createMathInstance(activeCurrencyRates)
    }
  }

  function setFormatSettings(locale: string, decimalPlaces: number) {
    activeLocale = locale
    activeDecimalPlaces = decimalPlaces
  }

  return {
    evaluateDocument,
    setCurrencyServiceState,
    updateCurrencyRates,
    setFormatSettings,
  }
}
