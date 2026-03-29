import type { RewriteRule } from '../types'
import { knownUnitTokens, TIME_UNIT_TOKEN_MAP } from '../constants'

export const groupedNumbers: RewriteRule = {
  id: 'grouped-numbers',
  category: 'normalize',
  priority: 100,
  apply: (ctx) => {
    let line = ctx.line.replace(
      /\b\d{1,3}(?:\s\d{3})+(?=\b|[a-z])/gi,
      match => match.replace(/\s+/g, ''),
    )
    line = line.replace(/\b\d+(?:\s+\d+)+\b/g, match =>
      match.replace(/\s+/g, ''))
    if (line === ctx.line)
      return null
    return { line, changed: true }
  },
}

export const degreeSigns: RewriteRule = {
  id: 'degree-signs',
  category: 'normalize',
  priority: 200,
  apply: (ctx) => {
    const line = ctx.line.replace(/(-?\d+(?:\.\d+)?)\s*°/g, '$1 deg')
    if (line === ctx.line)
      return null
    return { line, changed: true }
  },
}

export const reverseConversion: RewriteRule = {
  id: 'reverse-conversion',
  category: 'normalize',
  priority: 300,
  apply: (ctx) => {
    const line = ctx.line.replace(
      /^([a-z]+)\s+in\s+(\d+(?:\.\d+)?)\s+([a-z]+)$/i,
      (match, targetUnit: string, value: string, sourceUnit: string) => {
        if (
          knownUnitTokens.has(targetUnit.toLowerCase())
          && knownUnitTokens.has(sourceUnit.toLowerCase())
        ) {
          return `${value} ${sourceUnit} to ${targetUnit}`
        }
        return match
      },
    )
    if (line === ctx.line)
      return null
    return { line, changed: true }
  },
}

export const shorthandConversion: RewriteRule = {
  id: 'shorthand-conversion',
  category: 'normalize',
  priority: 400,
  apply: (ctx) => {
    const line = ctx.line.replace(
      /^([a-z]+)\s+([a-z]+)$/i,
      (match, unit1: string, unit2: string) => {
        if (
          knownUnitTokens.has(unit1.toLowerCase())
          && knownUnitTokens.has(unit2.toLowerCase())
        ) {
          return `1 ${unit1} to ${unit2}`
        }
        return match
      },
    )
    if (line === ctx.line)
      return null
    return { line, changed: true }
  },
}

export const unitAliases: RewriteRule = {
  id: 'unit-aliases',
  category: 'normalize',
  priority: 500,
  apply: (ctx) => {
    const line = ctx.line
      .replace(/\btea\s+spoons?\b/gi, 'teaspoon')
      .replace(/\btable\s+spoons?\b/gi, 'tablespoon')
      .replace(/\bnautical\s+miles?\b/gi, 'nauticalmile')
      .replace(/\blight\s+years?\b/gi, 'lightyear')
      .replace(/\bkm\/h\b/gi, 'kmh')
    if (line === ctx.line)
      return null
    return { line, changed: true }
  },
}

export const timeUnits: RewriteRule = {
  id: 'time-units',
  category: 'normalize',
  priority: 600,
  apply: (ctx) => {
    const line = ctx.line.replace(
      /\b(seconds?|minutes?|hours?|days?|weeks?|months?|years?)\b/gi,
      match => TIME_UNIT_TOKEN_MAP[match.toLowerCase()] || match,
    )
    if (line === ctx.line)
      return null
    return { line, changed: true }
  },
}

export const normalizeRules: RewriteRule[] = [
  groupedNumbers,
  degreeSigns,
  reverseConversion,
  shorthandConversion,
  unitAliases,
  timeUnits,
]
