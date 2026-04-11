import type { SpecialLineResult } from '../types'
import {
  evaluateTimeZoneLine,
  parseExplicitLocalTemporalExpression,
} from '../timeZones'
import { splitTopLevelAddSub } from '../utils'

interface DateArithmeticDeps {
  mathEvaluate: (expression: string, scope: Record<string, any>) => any
  formatResult: (result: any) => any
  locale: string
}

function evaluateDateLikeExpression(
  expression: string,
  now: Date,
  scope: Record<string, any>,
  deps: DateArithmeticDeps,
) {
  const timeZoneResult = evaluateTimeZoneLine(expression, now, deps.locale)
  if (timeZoneResult?.rawResult instanceof Date) {
    return timeZoneResult.rawResult
  }

  const localTemporalResult = parseExplicitLocalTemporalExpression(
    expression,
    now,
    deps.locale,
  )
  if (localTemporalResult) {
    return localTemporalResult.date
  }

  try {
    const result = deps.mathEvaluate(expression, scope)
    return result instanceof Date ? result : null
  }
  catch {
    return null
  }
}

function evaluateDurationMilliseconds(
  expression: string,
  scope: Record<string, any>,
  deps: DateArithmeticDeps,
) {
  try {
    const result = deps.mathEvaluate(expression, scope)
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

export function evaluateDateArithmeticLine(
  line: string,
  now: Date,
  scope: Record<string, any>,
  deps: DateArithmeticDeps,
): SpecialLineResult | null {
  const split = splitTopLevelAddSub(line)
  if (!split)
    return null

  const initialDate = evaluateDateLikeExpression(
    split.terms[0],
    now,
    scope,
    deps,
  )
  const initialDuration = initialDate
    ? null
    : evaluateDurationMilliseconds(split.terms[0], scope, deps)

  if (!initialDate && initialDuration === null)
    return null

  let currentDate = initialDate ? new Date(initialDate.getTime()) : null
  let currentDuration = initialDuration

  for (let index = 0; index < split.operators.length; index++) {
    const operator = split.operators[index]
    const term = split.terms[index + 1]
    const nextDate = evaluateDateLikeExpression(term, now, scope, deps)
    const nextDuration = nextDate
      ? null
      : evaluateDurationMilliseconds(term, scope, deps)

    if (currentDate) {
      if (nextDuration === null)
        return null
      currentDate = new Date(
        currentDate.getTime()
        + (operator === '+' ? nextDuration : -nextDuration),
      )
      continue
    }

    if (nextDate) {
      if (operator !== '+' || currentDuration === null)
        return null
      currentDate = new Date(nextDate.getTime() + currentDuration)
      currentDuration = null
      continue
    }

    if (currentDuration === null || nextDuration === null)
      return null
    currentDuration
      = operator === '+'
        ? currentDuration + nextDuration
        : currentDuration - nextDuration
  }

  if (!currentDate)
    return null

  return {
    lineResult: deps.formatResult(currentDate),
    rawResult: currentDate,
  }
}

export function evaluateDateAssignmentLine(
  line: string,
  now: Date,
  scope: Record<string, any>,
  deps: DateArithmeticDeps,
): SpecialLineResult | null {
  const assignmentIndex = line.indexOf('=')
  if (assignmentIndex <= 0)
    return null

  const variableName = line.slice(0, assignmentIndex).trim()
  if (!/^[a-z_]\w*$/i.test(variableName))
    return null

  const expression = line.slice(assignmentIndex + 1).trim()
  if (!expression)
    return null

  const dateValue = evaluateDateLikeExpression(expression, now, scope, deps)
  if (!dateValue)
    return null

  scope[variableName] = dateValue

  return {
    lineResult: {
      ...deps.formatResult(dateValue),
      type: 'assignment',
    },
    rawResult: dateValue,
  }
}
