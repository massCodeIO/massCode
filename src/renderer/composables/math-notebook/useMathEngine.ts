import type {
  CssContext,
  CurrencyServiceState,
  LineClassification,
  LineResult,
} from './math-engine/types'
import { evaluateCalendarLine } from './math-engine/calendar'
import {
  DEFAULT_EM_IN_PX,
  DEFAULT_PPI,
  HUMANIZED_UNIT_NAMES,
  SUPPORTED_CURRENCY_CODES,
} from './math-engine/constants'
import { evaluateCssLine } from './math-engine/css'
import {
  evaluateBlockAggregate,
  evaluateInlineAggregate,
} from './math-engine/evaluators/aggregates'
import {
  evaluateDateArithmeticLine,
  evaluateDateAssignmentLine,
} from './math-engine/evaluators/dateArithmetic'
import { formatMathDate, formatMathNumber } from './math-engine/format'
import { createMathInstance } from './math-engine/mathInstance'
import { analysisNormalize } from './math-engine/pipeline/analysisNormalize'
import { classify } from './math-engine/pipeline/classify'
import { rewrite } from './math-engine/pipeline/rewrite'
import {
  evaluateTimeZoneDifferenceLine,
  evaluateTimeZoneLine,
  parseExplicitLocalTemporalExpression,
} from './math-engine/timeZones'
import { coerceToNumber, toFraction } from './math-engine/utils'

export type { LineResult } from './math-engine/types'

let activeCurrencyRates: Record<string, number> = {}
let currencyServiceState: CurrencyServiceState = 'loading'
let currencyUnavailableMessage = ''
let math = createMathInstance(activeCurrencyRates)

let activeLocale = 'en-US'
let activeDecimalPlaces = 6

// --- Formatting helpers (depend on module-level math instance and locale) ---

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

  result = result.replace(
    /\b(mc(?:second|minute|hour|day|week|month|year))\b/g,
    (_, unitId: string) => humanizeUnitToken(unitId),
  )

  return result
}

function formatResult(result: any): LineResult {
  if (result === undefined || result === null) {
    return { value: null, error: null, type: 'empty' }
  }

  if (typeof result === 'boolean') {
    return { value: String(result), error: null, type: 'number' }
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
    // Implicit rate simplification: currency * time → currency
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
          const simplified = math.unit(currencyAmount, currencyUnit.unit.name)
          return {
            value: humanizeFormattedUnits(
              math.format(simplified, { precision: activeDecimalPlaces }),
            ),
            error: null,
            type: 'unit',
          }
        }
        catch {
          /* fall through */
        }
      }
    }

    return {
      value: humanizeFormattedUnits(
        math.format(result, { precision: activeDecimalPlaces }),
      ),
      error: null,
      type: 'unit',
    }
  }

  if (typeof result === 'number') {
    return {
      value: formatMathNumber(result, activeLocale, activeDecimalPlaces),
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

// --- Modifier application ---

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
      value: `${formatMathNumber(num, activeLocale, activeDecimalPlaces)}x`,
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

  return {
    value: formatMathNumber(num, activeLocale, activeDecimalPlaces),
    error: null,
    type: 'number',
    numericValue: num,
  }
}

// --- Strip modifier suffix from expression before eval ---

function stripModifierSuffix(
  raw: string,
  classification: LineClassification,
): string {
  const lower = raw.toLowerCase()

  if (classification.modifiers.rounding) {
    const patterns = [
      /\s+to\s+\d+\s+(?:dp|digits?)$/i,
      /\s+rounded\s+(?:up|down)\s+to\s+nearest\s+\w+$/i,
      /\s+(?:rounded\s+)?to\s+nearest\s+\w+$/i,
      /\s+rounded\s+(?:up|down)$/i,
      /\s+rounded$/i,
    ]
    for (const p of patterns) {
      const m = lower.match(p)
      if (m)
        return raw.slice(0, m.index!).trim()
    }
  }

  if (classification.modifiers.stripUnit) {
    const suffixes = [
      'as number',
      'to number',
      'as decimal',
      'to decimal',
      'as dec',
      'to dec',
      'as fraction',
      'to fraction',
    ]
    for (const s of suffixes) {
      if (lower.endsWith(s))
        return raw.slice(0, raw.length - s.length).trim()
    }
  }

  if (classification.modifiers.resultFormat) {
    const suffixes = [
      'in hex',
      'in bin',
      'in oct',
      'in sci',
      'in scientific',
      'as multiplier',
      'to multiplier',
    ]
    for (const s of suffixes) {
      if (lower.endsWith(s))
        return raw.slice(0, raw.length - s.length).trim()
    }
  }

  return raw
}

const UNSUPPORTED_MODIFIER_ERROR
  = 'Modifier is not supported for this expression type'

function hasAnyModifier(classification: LineClassification) {
  return Boolean(
    classification.modifiers.rounding
    || classification.modifiers.stripUnit
    || classification.modifiers.resultFormat,
  )
}

function hasUnsupportedModifierCombination(
  classification: LineClassification,
  normalizedExpression: string,
): boolean {
  if (!hasAnyModifier(classification))
    return false

  if (
    classification.primary === 'timezone'
    || classification.primary === 'calendar'
    || classification.primary === 'css'
    || classification.primary === 'date-arithmetic'
  ) {
    return true
  }

  if (
    classification.primary === 'assignment'
    && classification.assignmentTarget
    && classification.assignmentTarget !== 'math'
  ) {
    return true
  }

  if (
    classification.primary === 'math'
    && /\b(?:today|tomorrow|yesterday|now)\b/.test(normalizedExpression)
  ) {
    return true
  }

  return false
}

// --- Main composable ---

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

    const mathDeps = {
      mathEvaluate: (expr: string, s: Record<string, any>) =>
        math.evaluate(expr, s),
      formatResult,
    }

    for (const line of lines) {
      const trimmed = line.trim()

      // --- Stage 1: Analysis Normalize ---
      const view = analysisNormalize(trimmed)

      // --- Stage 2: Classify ---
      const classification = classify(view)

      // --- Early returns ---
      if (classification.primary === 'empty') {
        results.push({ value: null, error: null, type: 'empty' })
        prevResult = undefined
        numericBlock = []
        continue
      }

      if (classification.primary === 'comment') {
        results.push({ value: null, error: null, type: 'comment' })
        continue
      }

      if (prevResult !== undefined) {
        scope.prev = prevResult
      }

      // --- Aggregates (work on numericBlock, before rewrite) ---
      if (classification.primary === 'aggregate-block') {
        const keyword = view.normalized.trim()
        const aggResult = evaluateBlockAggregate(keyword, numericBlock)
        const value = aggResult?.value ?? 0
        const formatted = formatResult(value)
        formatted.type = 'aggregate'
        results.push(formatted)
        prevResult = value
        numericBlock.push(value)
        continue
      }

      if (classification.primary === 'aggregate-inline') {
        const aggResult = evaluateInlineAggregate(trimmed)
        if (aggResult) {
          const formatted = formatResult(aggResult.value)
          formatted.type = 'aggregate'
          results.push(formatted)
          prevResult = aggResult.value
          numericBlock.push(aggResult.value)
          continue
        }
      }

      try {
        // --- Currency service gate ---
        if (
          currencyServiceState !== 'ready'
          && classification.features.hasCurrency
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

        // --- Strip modifier suffix from trimmed for speculative handlers ---
        const effectiveTrimmed = stripModifierSuffix(trimmed, classification)
        const effectiveView = analysisNormalize(effectiveTrimmed)

        if (
          hasUnsupportedModifierCombination(
            classification,
            effectiveView.normalized,
          )
        ) {
          results.push({
            value: null,
            error: UNSUPPORTED_MODIFIER_ERROR,
            showError: true,
            type: 'empty',
          })
          prevResult = undefined
          continue
        }

        // --- Rounding/strip/format early path ---
        // If modifiers detected, process expression with stripped suffix first
        if (hasAnyModifier(classification)) {
          let processed = rewrite(effectiveView, classification)
          // Strip rewrite-generated suffixes (e.g. multiplier phrases produce "X to multiplier")
          const processedLower = processed.toLowerCase()
          if (processedLower.endsWith('to multiplier')) {
            processed = processed
              .slice(0, processed.length - 'to multiplier'.length)
              .trim()
          }
          const result = math.evaluate(processed, scope)

          if (result !== undefined) {
            const { modifiers } = classification
            if (modifiers.rounding) {
              const num = getNumericValue(result)
              if (num !== null) {
                const rounded = applyRoundingModifier(num, modifiers.rounding)
                const formatted = formatResult(rounded)
                results.push(formatted)
                prevResult = rounded
                numericBlock.push(rounded)
                continue
              }
            }
            if (modifiers.stripUnit) {
              const formatted = applyStripUnit(result, modifiers.stripUnit)
              results.push(formatted)
              prevResult = result
              const nv = getNumericValue(result)
              if (nv !== null)
                numericBlock.push(nv)
              continue
            }
            if (modifiers.resultFormat) {
              const formatted = applyResultFormat(
                result,
                modifiers.resultFormat,
              )
              results.push(formatted)
              prevResult = result
              const nv = getNumericValue(result)
              if (nv !== null)
                numericBlock.push(nv)
              continue
            }
          }
        }

        // --- Stage 3: Rewrite ---
        const strippedExpression = stripModifierSuffix(
          view.expression,
          classification,
        )
        const strippedView = { ...view, expression: strippedExpression }
        const processed = rewrite(strippedView, classification)

        // --- Speculative handlers (timezone, calendar, css) ---

        const tzDiffResult = evaluateTimeZoneDifferenceLine(
          trimmed,
          currentDate,
          {
            createHourUnit: hours => math.unit(hours, 'hour'),
            formatResult,
          },
        )
        if (tzDiffResult) {
          results.push(tzDiffResult.lineResult)
          prevResult = tzDiffResult.rawResult
          const nv = getNumericValue(tzDiffResult.rawResult)
          if (nv !== null)
            numericBlock.push(nv)
          continue
        }

        const tzResult = evaluateTimeZoneLine(trimmed, currentDate)
        if (tzResult) {
          results.push(tzResult.lineResult)
          prevResult = tzResult.rawResult
          continue
        }

        const calResult = evaluateCalendarLine(
          trimmed,
          currentDate,
          activeLocale,
        )
        if (calResult) {
          results.push(calResult.lineResult)
          prevResult = calResult.rawResult
          const nv = getNumericValue(calResult.rawResult)
          if (nv !== null)
            numericBlock.push(nv)
          continue
        }

        const cssResult = evaluateCssLine(trimmed, cssContext)
        if (cssResult) {
          scope.em = cssContext.emPx
          scope.ppi = cssContext.ppi
          results.push(cssResult.lineResult)
          prevResult = cssResult.rawResult
          if (typeof cssResult.rawResult === 'number')
            numericBlock.push(cssResult.rawResult)
          continue
        }

        // --- Date assignment (speculative) ---
        const dateAssignResult = evaluateDateAssignmentLine(
          processed,
          currentDate,
          scope,
          mathDeps,
        )
        if (dateAssignResult) {
          results.push(dateAssignResult.lineResult)
          prevResult = dateAssignResult.rawResult
          continue
        }

        // --- Date arithmetic (speculative) ---
        const dateArithResult = evaluateDateArithmeticLine(
          processed,
          currentDate,
          scope,
          mathDeps,
        )
        if (dateArithResult) {
          results.push(dateArithResult.lineResult)
          prevResult = dateArithResult.rawResult
          continue
        }

        // --- Local temporal expression ---
        const localTemporalResult = parseExplicitLocalTemporalExpression(
          processed,
          currentDate,
        )
        if (localTemporalResult) {
          results.push(formatResult(localTemporalResult.date))
          prevResult = localTemporalResult.date
          continue
        }

        // --- Stage 4: Evaluate (math.js) ---
        const result = math.evaluate(processed, scope)

        if (result === undefined) {
          results.push({ value: null, error: null, type: 'empty' })
          prevResult = undefined
          continue
        }

        // Default formatting
        const formatted = formatResult(result)
        if (
          /^[a-z_]\w*\s*=/i.test(trimmed)
          && !/^[a-z_]\w*\s*==/i.test(trimmed)
        ) {
          formatted.type = 'assignment'
        }

        results.push(formatted)
        prevResult = result
        const nv = getNumericValue(result)
        if (nv !== null)
          numericBlock.push(nv)
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
    activeCurrencyRates = { ...rates }
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
