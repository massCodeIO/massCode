import type { EvaluateClassifiedLineOptions, MathDeps } from './evaluateTypes'
import {
  evaluateBlockAggregate,
  evaluateInlineAggregate,
} from '../evaluators/aggregates'
import { analysisNormalize } from './analysisNormalize'
import {
  hasAnyModifier,
  hasUnsupportedModifierCombination,
  stripModifierSuffix,
  UNSUPPORTED_MODIFIER_ERROR,
} from './evaluateHelpers'
import { evaluateMathPath } from './evaluateMath'
import { evaluatePrimaryIntent } from './evaluateRoutes'
import { rewrite } from './rewrite'

export function evaluateClassifiedLine(
  options: EvaluateClassifiedLineOptions,
): EvaluatedLine {
  const {
    activeLocale,
    activeDateFormat,
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
    if (!aggregate) {
      return {
        lineResult: { value: null, error: null, type: 'empty' },
        rawResult: undefined,
      }
    }
    let lineResult: LineResult
    if (aggregate.unit) {
      const unitResult = math.unit(aggregate.value, aggregate.unit)
      lineResult = formatResult(unitResult)
    }
    else {
      lineResult = formatResult(aggregate.value)
    }
    lineResult.type = 'aggregate'
    return {
      lineResult,
      rawResult: aggregate.value,
      numericValue: aggregate.value,
      unitName: aggregate.unit,
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
          const rounding = classification.modifiers.rounding
          const rounded = formatter.applyRoundingModifier(
            numericValue,
            rounding,
          )
          const precision = rounding.type === 'dp' ? rounding.param : undefined
          return {
            lineResult: formatResult(rounded, precision),
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
    activeDateFormat,
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
    locale: activeLocale,
  }
  return evaluateMathPath(
    trimmed,
    processed,
    currentDate,
    activeLocale,
    scope,
    math,
    mathDeps,
    formatResult,
    getNumericValue,
  )
}
