import type { RewriteRule } from '../types'
import {
  currencySymbols,
  currencyWordNames,
  knownUnitTokens,
  weightContextPattern,
} from '../constants'

export const currencySymbolsRule: RewriteRule = {
  id: 'currency-symbols',
  category: 'syntax-rewrite',
  priority: 100,
  apply: (ctx) => {
    let line = ctx.line.replace(
      /R\$\s*(\d+(?:\.\d+)?(?:\s*[kKM])?)\b/g,
      '$1 BRL',
    )

    for (const [symbol, code] of Object.entries(currencySymbols)) {
      if (symbol === 'R$')
        continue
      const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      line = line.replace(
        new RegExp(`${escaped}\\s*(\\d+(?:\\.\\d+)?(?:\\s*(?:k|M))?)\\b`, 'g'),
        `$1 ${code}`,
      )
    }

    if (line === ctx.line)
      return null
    return { line, changed: true }
  },
}

export const currencyWordsRule: RewriteRule = {
  id: 'currency-words',
  category: 'syntax-rewrite',
  priority: 200,
  apply: (ctx) => {
    const line = ctx.line.replace(
      /(\d+(?:\.\d+)?)\s+(dollars?|euros?|pounds?|roubles?|rubles?|yen|yuan|rupees?|reais|real|pesos?)\b/gi,
      (
        match,
        amount: string,
        currencyName: string,
        _offset: number,
        fullLine: string,
      ) => {
        const lower = currencyName.toLowerCase()
        if (
          (lower === 'pound' || lower === 'pounds')
          && weightContextPattern.test(fullLine)
        ) {
          return match
        }
        const code = currencyWordNames[lower]
        return code ? `${amount} ${code}` : match
      },
    )
    if (line === ctx.line)
      return null
    return { line, changed: true }
  },
}

export const scalesRule: RewriteRule = {
  id: 'scales',
  category: 'syntax-rewrite',
  priority: 300,
  apply: (ctx) => {
    const line = ctx.line
      .replace(/(\d+(?:\.\d+)?)\s*k\b/g, '($1 * 1000)')
      .replace(/(\d+(?:\.\d+)?)\s*M\b/g, '($1 * 1000000)')
      .replace(/(\d+(?:\.\d+)?)\s*(?:bn|B)\b/g, '($1 * 1000000000)')
      .replace(/(\d+(?:\.\d+)?)\s*(?:tn|T)\b/g, '($1 * 1000000000000)')
      .replace(/(\d+(?:\.\d+)?)\s+trillion\b/gi, '($1 * 1000000000000)')
      .replace(/(\d+(?:\.\d+)?)\s+billion\b/gi, '($1 * 1000000000)')
      .replace(/(\d+(?:\.\d+)?)\s+million\b/gi, '($1 * 1000000)')
      .replace(/(\d+(?:\.\d+)?)\s+thousand\b/gi, '($1 * 1000)')
    if (line === ctx.line)
      return null
    return { line, changed: true }
  },
}

function normalizePowerUnit(unit: string) {
  switch (unit.toLowerCase()) {
    case 'inches':
    case 'inch':
      return 'inch'
    case 'feet':
    case 'foot':
    case 'ft':
      return 'ft'
    case 'meters':
    case 'meter':
    case 'm':
      return 'm'
    case 'centimeter':
    case 'centimeters':
    case 'cm':
      return 'cm'
    case 'millimeter':
    case 'millimeters':
    case 'mm':
      return 'mm'
    case 'kilometer':
    case 'kilometers':
    case 'km':
      return 'km'
    case 'yards':
    case 'yard':
      return 'yard'
    case 'miles':
    case 'mile':
      return 'mile'
    default:
      return unit.toLowerCase()
  }
}

export const areaVolumeAliasesRule: RewriteRule = {
  id: 'area-volume-aliases',
  category: 'syntax-rewrite',
  priority: 400,
  apply: (ctx) => {
    let line = ctx.line.replace(/\bsqm\b/gi, 'm^2').replace(/\bcbm\b/gi, 'm^3')

    line = line.replace(
      /(\d+(?:\.\d+)?)\s+(sq|square)\s+([a-z]+)/gi,
      (_, value: string, _p: string, unit: string) =>
        `${value} ${normalizePowerUnit(unit)}^2`,
    )
    line = line.replace(
      /(\b(?:in|to|as|into)\s+)(sq|square)\s+([a-z]+)/gi,
      (_, prefix: string, _k: string, unit: string) =>
        `${prefix}${normalizePowerUnit(unit)}^2`,
    )
    line = line.replace(
      /(\d+(?:\.\d+)?)\s+(cu|cubic|cb)\s+([a-z]+)/gi,
      (_, value: string, _p: string, unit: string) =>
        `${value} ${normalizePowerUnit(unit)}^3`,
    )
    line = line.replace(
      /(\b(?:in|to|as|into)\s+)(cu|cubic|cb)\s+([a-z]+)/gi,
      (_, prefix: string, _k: string, unit: string) =>
        `${prefix}${normalizePowerUnit(unit)}^3`,
    )

    if (line === ctx.line)
      return null
    return { line, changed: true }
  },
}

export const stackedUnitsRule: RewriteRule = {
  id: 'stacked-units',
  category: 'syntax-rewrite',
  priority: 500,
  apply: (ctx) => {
    const line = ctx.line.replace(
      /-?\d+(?:\.\d+)?\s+[a-z]+(?:\s+-?\d+(?:\.\d+)?\s+[a-z]+)+/gi,
      (match) => {
        const tokens = match.trim().split(/\s+/)
        const pairs: string[] = []
        for (let i = 0; i < tokens.length; i += 2) {
          if (!/^-?\d+(?:\.\d+)?$/.test(tokens[i]))
            return match
          const unit = tokens[i + 1]?.toLowerCase()
          if (!unit || !knownUnitTokens.has(unit))
            return match
          pairs.push(`${tokens[i]} ${tokens[i + 1]}`)
        }
        return pairs.length >= 2 ? `(${pairs.join(' + ')})` : match
      },
    )
    if (line === ctx.line)
      return null
    return { line, changed: true }
  },
}

export const syntaxRewriteRules: RewriteRule[] = [
  currencySymbolsRule,
  currencyWordsRule,
  scalesRule,
  areaVolumeAliasesRule,
  stackedUnitsRule,
]
