import type {
  EvaluatedLine,
  MathDeps,
  MathEvaluatorInstance,
} from './evaluateTypes'
import type { LineFormatter } from './format'
import {
  evaluateDateArithmeticLine,
  evaluateDateAssignmentLine,
} from '../evaluators/dateArithmetic'
import { parseExplicitLocalTemporalExpression } from '../timeZones'
import { toEvaluatedLine } from './evaluateHelpers'

export function evaluateMathPath(
  trimmed: string,
  processed: string,
  currentDate: Date,
  locale: string,
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
    locale,
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
