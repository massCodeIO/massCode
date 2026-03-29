import type {
  AnalysisView,
  CssContext,
  CurrencyServiceState,
  LineClassification,
  LineResult,
} from '../types'
import type { LineFormatter } from './format'
import { evaluateCalendarLine } from '../calendar'
import { evaluateCssLine } from '../css'
import {
  evaluateBlockAggregate,
  evaluateInlineAggregate,
} from '../evaluators/aggregates'
import {
  evaluateDateArithmeticLine,
  evaluateDateAssignmentLine,
} from '../evaluators/dateArithmetic'
import {
  evaluateTimeZoneDifferenceLine,
  evaluateTimeZoneLine,
  parseExplicitLocalTemporalExpression,
} from '../timeZones'
import { analysisNormalize } from './analysisNormalize'
import { rewrite } from './rewrite'

const UNSUPPORTED_MODIFIER_ERROR
  = 'Modifier is not supported for this expression type'

interface MathEvaluatorInstance {
  evaluate: (expression: string, scope: Record<string, any>) => any
  unit: (value: number, unit: string) => any
}

interface EvaluateClassifiedLineOptions {
  trimmed: string
  view: AnalysisView
  classification: LineClassification
  scope: Record<string, any>
  cssContext: CssContext
  currentDate: Date
  numericBlock: number[]
  math: MathEvaluatorInstance
  formatter: LineFormatter
  currencyServiceState: CurrencyServiceState
  currencyUnavailableMessage: string
  activeLocale: string
}

interface EvaluatedLine {
  lineResult: LineResult
  rawResult: any
  numericValue?: number | null
  resetPrev?: boolean
  resetNumericBlock?: boolean
}

interface MathDeps {
  mathEvaluate: (expression: string, scope: Record<string, any>) => any
  formatResult: LineFormatter['formatResult']
}

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
    for (const pattern of patterns) {
      const match = lower.match(pattern)
      if (match)
        return raw.slice(0, match.index!).trim()
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
    for (const suffix of suffixes) {
      if (lower.endsWith(suffix))
        return raw.slice(0, raw.length - suffix.length).trim()
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
    for (const suffix of suffixes) {
      if (lower.endsWith(suffix))
        return raw.slice(0, raw.length - suffix.length).trim()
    }
  }

  return raw
}

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

function toEvaluatedLine(
  lineResult: LineResult,
  rawResult: any,
  numericValue?: number | null,
): EvaluatedLine {
  return {
    lineResult,
    rawResult,
    numericValue,
  }
}

function evaluatePrimaryIntent(
  classification: LineClassification,
  trimmed: string,
  processed: string,
  currentDate: Date,
  activeLocale: string,
  cssContext: CssContext,
  scope: Record<string, any>,
  math: MathEvaluatorInstance,
  formatResult: LineFormatter['formatResult'],
  getNumericValue: LineFormatter['getNumericValue'],
): EvaluatedLine | null {
  switch (classification.primary) {
    case 'timezone': {
      if (classification.timezoneOperation === 'difference') {
        const timeZoneDifferenceResult = evaluateTimeZoneDifferenceLine(
          trimmed,
          currentDate,
          {
            createHourUnit: hours => math.unit(hours, 'hour'),
            formatResult,
          },
        )

        if (timeZoneDifferenceResult) {
          return toEvaluatedLine(
            timeZoneDifferenceResult.lineResult,
            timeZoneDifferenceResult.rawResult,
            getNumericValue(timeZoneDifferenceResult.rawResult),
          )
        }
      }

      const timeZoneResult = evaluateTimeZoneLine(trimmed, currentDate)
      if (timeZoneResult) {
        return toEvaluatedLine(
          timeZoneResult.lineResult,
          timeZoneResult.rawResult,
        )
      }

      return null
    }

    case 'calendar': {
      const calendarResult = evaluateCalendarLine(
        trimmed,
        currentDate,
        activeLocale,
      )

      if (calendarResult) {
        return toEvaluatedLine(
          calendarResult.lineResult,
          calendarResult.rawResult,
          getNumericValue(calendarResult.rawResult),
        )
      }

      return null
    }

    case 'css':
    case 'assignment': {
      if (
        classification.primary === 'css'
        || classification.assignmentTarget === 'css'
      ) {
        const cssResult = evaluateCssLine(trimmed, cssContext)
        if (cssResult) {
          scope.em = cssContext.emPx
          scope.ppi = cssContext.ppi
          return toEvaluatedLine(
            cssResult.lineResult,
            cssResult.rawResult,
            typeof cssResult.rawResult === 'number'
              ? cssResult.rawResult
              : null,
          )
        }
      }

      if (classification.assignmentTarget === 'date') {
        const dateAssignmentResult = evaluateDateAssignmentLine(
          processed,
          currentDate,
          scope,
          {
            mathEvaluate: (expression, nextScope) =>
              math.evaluate(expression, nextScope),
            formatResult,
          },
        )

        if (dateAssignmentResult) {
          return toEvaluatedLine(
            dateAssignmentResult.lineResult,
            dateAssignmentResult.rawResult,
          )
        }
      }

      return null
    }

    case 'date-arithmetic': {
      const dateArithmeticResult = evaluateDateArithmeticLine(
        processed,
        currentDate,
        scope,
        {
          mathEvaluate: (expression, nextScope) =>
            math.evaluate(expression, nextScope),
          formatResult,
        },
      )

      if (dateArithmeticResult) {
        return toEvaluatedLine(
          dateArithmeticResult.lineResult,
          dateArithmeticResult.rawResult,
        )
      }

      return null
    }

    default:
      return null
  }
}

function evaluateMathPath(
  trimmed: string,
  processed: string,
  currentDate: Date,
  scope: Record<string, any>,
  math: MathEvaluatorInstance,
  mathDeps: MathDeps,
  formatResult: LineFormatter['formatResult'],
  getNumericValue: LineFormatter['getNumericValue'],
): EvaluatedLine {
  const dateAssignmentResult = evaluateDateAssignmentLine(
    processed,
    currentDate,
    scope,
    mathDeps,
  )
  if (dateAssignmentResult) {
    return toEvaluatedLine(
      dateAssignmentResult.lineResult,
      dateAssignmentResult.rawResult,
    )
  }

  const dateArithmeticResult = evaluateDateArithmeticLine(
    processed,
    currentDate,
    scope,
    mathDeps,
  )
  if (dateArithmeticResult) {
    return toEvaluatedLine(
      dateArithmeticResult.lineResult,
      dateArithmeticResult.rawResult,
    )
  }

  const localTemporalResult = parseExplicitLocalTemporalExpression(
    processed,
    currentDate,
  )
  if (localTemporalResult) {
    return toEvaluatedLine(
      formatResult(localTemporalResult.date),
      localTemporalResult.date,
    )
  }

  const result = math.evaluate(processed, scope)
  if (result === undefined) {
    return {
      lineResult: { value: null, error: null, type: 'empty' },
      rawResult: undefined,
      resetPrev: true,
    }
  }

  const lineResult = formatResult(result)
  if (/^[a-z_]\w*\s*=/i.test(trimmed) && !/^[a-z_]\w*\s*==/i.test(trimmed)) {
    lineResult.type = 'assignment'
  }

  return toEvaluatedLine(lineResult, result, getNumericValue(result))
}

export function evaluateClassifiedLine(
  options: EvaluateClassifiedLineOptions,
): EvaluatedLine {
  const {
    activeLocale,
    classification,
    cssContext,
    currencyServiceState,
    currencyUnavailableMessage,
    currentDate,
    formatter,
    math,
    numericBlock,
    scope,
    trimmed,
    view,
  } = options
  const { formatResult, getNumericValue } = formatter

  if (classification.primary === 'empty') {
    return {
      lineResult: { value: null, error: null, type: 'empty' },
      rawResult: undefined,
      resetPrev: true,
      resetNumericBlock: true,
    }
  }

  if (classification.primary === 'comment') {
    return {
      lineResult: { value: null, error: null, type: 'comment' },
      rawResult: undefined,
    }
  }

  if (classification.primary === 'aggregate-block') {
    const keyword = view.normalized.trim()
    const aggregate = evaluateBlockAggregate(keyword, numericBlock)
    const value = aggregate?.value ?? 0
    const lineResult = formatResult(value)
    lineResult.type = 'aggregate'
    return {
      lineResult,
      rawResult: value,
      numericValue: value,
    }
  }

  if (classification.primary === 'aggregate-inline') {
    const aggregate = evaluateInlineAggregate(trimmed)
    if (aggregate) {
      const lineResult = formatResult(aggregate.value)
      lineResult.type = 'aggregate'
      return {
        lineResult,
        rawResult: aggregate.value,
        numericValue: aggregate.value,
      }
    }
  }

  if (currencyServiceState !== 'ready' && classification.features.hasCurrency) {
    return {
      lineResult:
        currencyServiceState === 'loading'
          ? { value: null, error: null, type: 'pending' }
          : {
              value: null,
              error: currencyUnavailableMessage,
              showError: true,
              type: 'empty',
            },
      rawResult: undefined,
      resetPrev: true,
    }
  }

  const effectiveTrimmed = stripModifierSuffix(trimmed, classification)
  const effectiveView = analysisNormalize(effectiveTrimmed)

  if (
    hasUnsupportedModifierCombination(classification, effectiveView.normalized)
  ) {
    return {
      lineResult: {
        value: null,
        error: UNSUPPORTED_MODIFIER_ERROR,
        showError: true,
        type: 'empty',
      },
      rawResult: undefined,
      resetPrev: true,
    }
  }

  if (hasAnyModifier(classification)) {
    let processed = rewrite(effectiveView, classification)
    if (processed.toLowerCase().endsWith('to multiplier')) {
      processed = processed
        .slice(0, processed.length - 'to multiplier'.length)
        .trim()
    }

    const result = math.evaluate(processed, scope)
    if (result !== undefined) {
      if (classification.modifiers.rounding) {
        const numericValue = getNumericValue(result)
        if (numericValue !== null) {
          const rounded = formatter.applyRoundingModifier(
            numericValue,
            classification.modifiers.rounding,
          )
          return {
            lineResult: formatResult(rounded),
            rawResult: rounded,
            numericValue: rounded,
          }
        }
      }

      if (classification.modifiers.stripUnit) {
        return {
          lineResult: formatter.applyStripUnit(
            result,
            classification.modifiers.stripUnit,
          ),
          rawResult: result,
          numericValue: getNumericValue(result),
        }
      }

      if (classification.modifiers.resultFormat) {
        return {
          lineResult: formatter.applyResultFormat(
            result,
            classification.modifiers.resultFormat,
          ),
          rawResult: result,
          numericValue: getNumericValue(result),
        }
      }
    }
  }

  const strippedView = {
    ...view,
    expression: stripModifierSuffix(view.expression, classification),
  }
  const processed = rewrite(strippedView, classification)

  const routedResult = evaluatePrimaryIntent(
    classification,
    trimmed,
    processed,
    currentDate,
    activeLocale,
    cssContext,
    scope,
    math,
    formatResult,
    getNumericValue,
  )
  if (routedResult) {
    return routedResult
  }

  const mathDeps: MathDeps = {
    mathEvaluate: (expression: string, nextScope: Record<string, any>) =>
      math.evaluate(expression, nextScope),
    formatResult,
  }
  return evaluateMathPath(
    trimmed,
    processed,
    currentDate,
    scope,
    math,
    mathDeps,
    formatResult,
    getNumericValue,
  )
}
