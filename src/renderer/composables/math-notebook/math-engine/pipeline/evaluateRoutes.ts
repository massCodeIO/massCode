import type { DateFormatStyle } from '../format'
import type { CssContext, LineClassification } from '../types'
import type { EvaluatedLine, MathEvaluatorInstance } from './evaluateTypes'
import type { LineFormatter } from './format'
import { evaluateCalendarLine } from '../calendar'
import { evaluateCssLine } from '../css'
import { evaluateCookingLine } from '../evaluators/cooking'
import {
  evaluateDateArithmeticLine,
  evaluateDateAssignmentLine,
} from '../evaluators/dateArithmetic'
import { evaluateFinanceLine } from '../evaluators/finance'
import {
  evaluateTimeZoneDifferenceLine,
  evaluateTimeZoneLine,
} from '../timeZones'
import { toEvaluatedLine } from './evaluateHelpers'

export function evaluatePrimaryIntent(
  classification: LineClassification,
  trimmed: string,
  processed: string,
  currentDate: Date,
  activeLocale: string,
  activeDateFormat: DateFormatStyle,
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

      const timeZoneResult = evaluateTimeZoneLine(
        trimmed,
        currentDate,
        activeLocale,
        activeDateFormat,
      )
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
        activeDateFormat,
      )

      if (calendarResult) {
        return toEvaluatedLine(
          calendarResult.lineResult,
          calendarResult.rawResult,
          getNumericValue(calendarResult.rawResult),
        )
      }

      // Finance calculations
      const financeResult = evaluateFinanceLine(trimmed, activeLocale)
      if (financeResult) {
        return toEvaluatedLine(
          financeResult.lineResult,
          financeResult.rawResult,
          financeResult.rawResult,
        )
      }

      // Cooking calculations
      const cookingResult = evaluateCookingLine(trimmed, activeLocale)
      if (cookingResult) {
        return toEvaluatedLine(
          cookingResult.lineResult,
          cookingResult.rawResult,
          cookingResult.rawResult,
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
            locale: activeLocale,
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
          locale: activeLocale,
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
