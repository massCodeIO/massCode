import type { RewriteRule } from '../types'
import { SUPPORTED_CURRENCY_CODES } from '../constants'
import { splitByKeyword, splitTopLevelAddSub } from '../utils'

function extractAdditiveUnit(term: string) {
  const match = term.match(/^-?\d+(?:\.\d+)?\s+([a-z][a-z0-9^]*)$/i)
  if (!match)
    return null
  return match[1].toUpperCase()
    in Object.fromEntries(SUPPORTED_CURRENCY_CODES.map(code => [code, true]))
    ? match[1].toUpperCase()
    : match[1]
}

function isPlainNumberTerm(term: string) {
  return /^-?\d+(?:\.\d+)?$/.test(term)
}

function inferAdditiveUnitsForPlainNumbers(expression: string) {
  const split = splitTopLevelAddSub(expression)
  if (!split)
    return expression

  const explicitUnits = split.terms.map(extractAdditiveUnit)

  let changed = false
  const inferredTerms = split.terms.map((term, index) => {
    if (!isPlainNumberTerm(term))
      return term

    const previousUnit = explicitUnits.slice(0, index).reverse().find(Boolean)
    const nextUnit = explicitUnits.slice(index + 1).find(Boolean)
    const inheritedUnit = previousUnit || nextUnit

    if (!inheritedUnit)
      return term

    changed = true
    return `${term} ${inheritedUnit}`
  })

  if (!changed)
    return expression

  let rebuilt = inferredTerms[0]
  for (let i = 0; i < split.operators.length; i++) {
    rebuilt += ` ${split.operators[i]} ${inferredTerms[i + 1]}`
  }
  return rebuilt
}

export const additiveUnitInferenceRule: RewriteRule = {
  id: 'additive-unit-inference',
  category: 'finalize',
  priority: 100,
  apply: (ctx) => {
    const conversionSplit = splitByKeyword(ctx.line, [
      ' into ',
      ' as ',
      ' to ',
      ' in ',
    ])
    const sourceExpression = conversionSplit ? conversionSplit[0] : ctx.line
    const conversionTarget = conversionSplit ? conversionSplit[1] : null

    const inferredSource = inferAdditiveUnitsForPlainNumbers(sourceExpression)
    const hasAdditiveSource = splitTopLevelAddSub(sourceExpression) !== null

    if (!hasAdditiveSource)
      return null

    let line: string
    if (!conversionTarget) {
      line = inferredSource
    }
    else {
      line = `(${inferredSource}) to ${conversionTarget}`
    }

    if (line === ctx.line)
      return null
    return { line, changed: true }
  },
}

export const percentagesRule: RewriteRule = {
  id: 'percentages',
  category: 'finalize',
  priority: 200,
  apply: (ctx) => {
    const line = ctx.line
      // Z is X/Y of what → Z / (X/Y)
      .replace(
        /(\d+(?:\.\d+)?)\s+is\s+(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)\s+of\s+what\b/gi,
        '$1 / ($2 / $3)',
      )
      // X/Y of Z → (X/Y) * Z
      .replace(
        /(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)\s+of\s+(\d+(?:\.\d+)?)\b/gi,
        '($1 / $2) * $3',
      )
      .replace(
        /(\d+(?:\.\d+)?)%\s+of\s+what\s+is\s+(\d+(?:\.\d+)?)/gi,
        '$2 / ($1 / 100)',
      )
      .replace(
        /(\d+(?:\.\d+)?)%\s+on\s+what\s+is\s+(\d+(?:\.\d+)?)/gi,
        '$2 / (1 + $1 / 100)',
      )
      .replace(
        /(\d+(?:\.\d+)?)%\s+off\s+what\s+is\s+(\d+(?:\.\d+)?)/gi,
        '$2 / (1 - $1 / 100)',
      )
      // X is Y% of what
      .replace(
        /(\d+(?:\.\d+)?)\s+is\s+(\d+(?:\.\d+)?)%\s+of\s+what\b/gi,
        '$1 / ($2 / 100)',
      )
      // X is Y% on what
      .replace(
        /(\d+(?:\.\d+)?)\s+is\s+(\d+(?:\.\d+)?)%\s+on\s+what\b/gi,
        '$1 / (1 + $2 / 100)',
      )
      // X is Y% off what
      .replace(
        /(\d+(?:\.\d+)?)\s+is\s+(\d+(?:\.\d+)?)%\s+off\s+what\b/gi,
        '$1 / (1 - $2 / 100)',
      )
      // X to Y is what %
      .replace(
        /(\d+(?:\.\d+)?)\s+to\s+(\d+(?:\.\d+)?)\s+is\s+what\s*%/gi,
        '(($2 - $1) / $1) * 100',
      )
      // X to Y as %
      .replace(
        /(\d+(?:\.\d+)?)\s+to\s+(\d+(?:\.\d+)?)\s+as\s*%/gi,
        '(($2 - $1) / $1) * 100',
      )
      // X is what % off Y
      .replace(
        /(\d+(?:\.\d+)?)\s+is\s+what\s*%\s+off\s+(\d+(?:\.\d+)?)/gi,
        '(($2 - $1) / $2) * 100',
      )
      // X is what % on Y
      .replace(
        /(\d+(?:\.\d+)?)\s+is\s+what\s*%\s+on\s+(\d+(?:\.\d+)?)/gi,
        '(($1 - $2) / $2) * 100',
      )
      // X is what % of Y
      .replace(
        /(\d+(?:\.\d+)?)\s+is\s+what\s*%\s+of\s+(\d+(?:\.\d+)?)/gi,
        '($1 / $2) * 100',
      )
      .replace(
        /(\d+(?:\.\d+)?)\s+as\s+a\s+%\s+of\s+(\d+(?:\.\d+)?)/gi,
        '($1 / $2) * 100',
      )
      .replace(
        /(\d+(?:\.\d+)?)\s+as\s+a\s+%\s+on\s+(\d+(?:\.\d+)?)/gi,
        '(($1 - $2) / $2) * 100',
      )
      .replace(
        /(\d+(?:\.\d+)?)\s+as\s+a\s+%\s+off\s+(\d+(?:\.\d+)?)/gi,
        '(($2 - $1) / $2) * 100',
      )
      // X/Y as %
      .replace(
        /(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s+as\s*%/gi,
        '($1 / $2) * 100',
      )
      // X/Y %
      .replace(
        /(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*%(?!\s*\w)/g,
        '($1 / $2) * 100',
      )
      // 0.35 as %
      .replace(/(\d+(?:\.\d+)?)\s+as\s*%/gi, '$1 * 100')
      .replace(
        /(\d+(?:\.\d+)?)%\s+on\s+(\d+(?:\.\d+)?)/gi,
        '$2 * (1 + $1 / 100)',
      )
      .replace(
        /(\d+(?:\.\d+)?)%\s+off\s+(\d+(?:\.\d+)?)/gi,
        '$2 * (1 - $1 / 100)',
      )
      .replace(/(\d+(?:\.\d+)?)%\s+of\s+(\d+(?:\.\d+)?)/gi, '$1 / 100 * $2')
      .replace(
        /(\d+(?:\.\d+)?)\s*\+\s*(\d+(?:\.\d+)?)%/g,
        '$1 * (1 + $2 / 100)',
      )
      .replace(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)%/g, '$1 * (1 - $2 / 100)')
      .replace(/(\d+(?:\.\d+)?)%(?!\s*\w)/g, '$1 / 100')

    if (line === ctx.line)
      return null
    return { line, changed: true }
  },
}

export const conversionsRule: RewriteRule = {
  id: 'conversions',
  category: 'finalize',
  priority: 300,
  apply: (ctx) => {
    const line = ctx.line
      .replace(/\s+as\s+/gi, ' to ')
      .replace(/\s+into\s+/gi, ' to ')
    if (line === ctx.line)
      return null
    return { line, changed: true }
  },
}

export const finalizeRules: RewriteRule[] = [
  additiveUnitInferenceRule,
  percentagesRule,
  conversionsRule,
]
