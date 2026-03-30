import type { LineClassification, LineResult } from '../types'
import type { EvaluatedLine } from './evaluateTypes'

export const UNSUPPORTED_MODIFIER_ERROR
  = 'Modifier is not supported for this expression type'

export function stripModifierSuffix(
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
      'as timespan',
      'as laptime',
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
    const baseMatch = lower.match(/\s+(?:as|to)\s+base\s+\d+$/)
    if (baseMatch) {
      return raw.slice(0, baseMatch.index!).trim()
    }
    // Python-style: hex(...) → extract inner expression
    const funcMatch = raw.match(/^(?:hex|bin)\((.+)\)$/i)
    if (funcMatch) {
      return funcMatch[1]
    }
  }

  return raw
}

export function hasAnyModifier(classification: LineClassification) {
  return Boolean(
    classification.modifiers.rounding
    || classification.modifiers.stripUnit
    || classification.modifiers.resultFormat,
  )
}

export function hasUnsupportedModifierCombination(
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

function extractUnitInfo(
  rawResult: any,
): { numericValue: number, unitName: string } | null {
  if (
    rawResult
    && typeof rawResult === 'object'
    && typeof rawResult.toNumber === 'function'
    && Array.isArray(rawResult.units)
    && rawResult.units.length === 1
  ) {
    try {
      const unitEntry = rawResult.units[0]
      const unitName = unitEntry?.unit?.name
      if (unitName && unitEntry.power === 1) {
        return { numericValue: rawResult.toNumber(), unitName }
      }
    }
    catch {
      /* ignore */
    }
  }
  return null
}

export function toEvaluatedLine(
  lineResult: LineResult,
  rawResult: any,
  numericValue?: number | null,
): EvaluatedLine {
  const unitInfo = extractUnitInfo(rawResult)

  return {
    lineResult,
    rawResult,
    numericValue: unitInfo?.numericValue ?? numericValue,
    unitName: unitInfo?.unitName,
  }
}
