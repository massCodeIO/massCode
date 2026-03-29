import type { RewriteRule } from '../types'
import { MATH_UNARY_FUNCTIONS } from '../constants'

export const ratesRule: RewriteRule = {
  id: 'rates',
  category: 'semantic-rewrite',
  priority: 100,
  apply: (ctx) => {
    const line = ctx.line
      .replace(/\bper\b/gi, '/')
      .replace(
        /(\d+(?:\.\d+)?)\s+(\w+)\s+at\s+(\S+)\/(\w+)/gi,
        '$1 $2 * $3 / $4',
      )
      .replace(
        /(\S+)\s+a\s+(day|week|month|year)\s+for\s+(?:a\s+)?(\S+)/gi,
        '$1 / $2 * 1 $3',
      )
    if (line === ctx.line)
      return null
    return { line, changed: true }
  },
}

export const multipliersRule: RewriteRule = {
  id: 'multipliers',
  category: 'semantic-rewrite',
  priority: 200,
  apply: (ctx) => {
    const line = ctx.line
      .replace(
        /(\d+(?:\.\d+)?)\s+to\s+(\d+(?:\.\d+)?)\s+is\s+what\s+x\b/gi,
        '$2 / $1 as multiplier',
      )
      .replace(
        /(\d+(?:\.\d+)?)\s+to\s+(\d+(?:\.\d+)?)\s+as\s+x\b/gi,
        '$2 / $1 as multiplier',
      )
      .replace(
        /(\d+(?:\.\d+)?)\s+as\s+x\s+of\s+(\d+(?:\.\d+)?)/gi,
        '$1 / $2 as multiplier',
      )
      .replace(
        /(\d+(?:\.\d+)?)\s+as\s+multiplier\s+of\s+(\d+(?:\.\d+)?)/gi,
        '$1 / $2 as multiplier',
      )
      .replace(
        /(\d+(?:\.\d+)?)\s+as\s+multiplier\s+on\s+(\d+(?:\.\d+)?)/gi,
        '($1 - $2) / $2 as multiplier',
      )
      .replace(
        /(\d+(?:\.\d+)?)\s+as\s+x\s+off\s+(\d+(?:\.\d+)?)/gi,
        '($2 - $1) / $2 as multiplier',
      )
    if (line === ctx.line)
      return null
    return { line, changed: true }
  },
}

export const phraseFunctionsRule: RewriteRule = {
  id: 'phrase-functions',
  category: 'semantic-rewrite',
  priority: 300,
  apply: (ctx) => {
    const line = ctx.line
      .replace(/\bsquare\s+root\s+of\s+(\S+)/gi, 'sqrt($1)')
      .replace(/\bcube\s+root\s+of\s+(\S+)/gi, 'cbrt($1)')
      .replace(/\broot\s+(\d+)\s+of\s+(\S+)/gi, 'root($1, $2)')
      .replace(/\blog\s+(\S+)\s+base\s+(\S+)/gi, 'log($1, $2)')
      // Python-style base functions → format directives
      .replace(/^hex\(([^)]+)\)$/gi, '$1 in hex')
      .replace(/^bin\(([^)]+)\)$/gi, '$1 in bin')
      .replace(/^int\(([^)]+)\)$/gi, '$1')
      .replace(
        /(\d+(?:\.\d+)?)\s+is\s+(\d+(?:\.\d+)?)\s+to\s+(?:what|the\s+what)\s*(?:power)?/gi,
        'log($1) / log($2)',
      )
      .replace(/\b(sin|cos|tan)\((\d+(?:\.\d+)?)\s+degrees\)/gi, '$1($2 deg)')
    if (line === ctx.line)
      return null
    return { line, changed: true }
  },
}

function preprocessFunctionExpression(expression: string): string {
  const trimmed = expression.trim()
  const openIndex = trimmed.indexOf('(')
  const closeIndex = trimmed.endsWith(')') ? trimmed.length - 1 : -1

  if (openIndex > 0 && closeIndex > openIndex) {
    if (trimmed.toLowerCase().startsWith('root ')) {
      const degree = trimmed.slice(5, openIndex).trim()
      const value = trimmed.slice(openIndex + 1, closeIndex).trim()
      if (degree && value)
        return `root(${degree}, ${value})`
    }
    if (trimmed.toLowerCase().startsWith('log ')) {
      const base = trimmed.slice(4, openIndex).trim()
      const value = trimmed.slice(openIndex + 1, closeIndex).trim()
      if (base && value)
        return `log(${value}, ${base})`
    }
  }

  const unaryFunctionsPattern = MATH_UNARY_FUNCTIONS.join('|')
  const unaryMatch = trimmed.match(
    new RegExp(`^(${unaryFunctionsPattern})\\s+(.+)$`, 'i'),
  )
  if (unaryMatch && !unaryMatch[2].trim().startsWith('(')) {
    return `${unaryMatch[1]}(${unaryMatch[2].trim()})`
  }

  return expression
}

export const functionSyntaxRule: RewriteRule = {
  id: 'function-syntax',
  category: 'semantic-rewrite',
  priority: 400,
  apply: (ctx) => {
    let line: string
    const assignmentIndex = ctx.line.indexOf('=')
    if (assignmentIndex > 0) {
      const left = ctx.line.slice(0, assignmentIndex).trim()
      const right = ctx.line.slice(assignmentIndex + 1).trim()
      if (/^[a-z_]\w*$/i.test(left) && right) {
        line = `${ctx.line.slice(0, assignmentIndex + 1)} ${preprocessFunctionExpression(right)}`
      }
      else {
        line = preprocessFunctionExpression(ctx.line)
      }
    }
    else {
      line = preprocessFunctionExpression(ctx.line)
    }
    if (line === ctx.line)
      return null
    return { line, changed: true }
  },
}

export const functionConversionsRule: RewriteRule = {
  id: 'function-conversions',
  category: 'semantic-rewrite',
  priority: 500,
  apply: (ctx) => {
    const unaryFunctionsPattern = MATH_UNARY_FUNCTIONS.join('|')
    const line = ctx.line.replace(
      new RegExp(
        `(^|[=,+\\-*/(]\\s*)(${unaryFunctionsPattern})\\(([^()]+?)\\s+(?:in|to|as|into)\\s+([a-z][a-z0-9^]*)\\)`,
        'gi',
      ),
      (_, prefix: string, fn: string, source: string, target: string) => {
        return `${prefix}${fn}(unitValue(to(${source.trim()}, ${target.trim()})))`
      },
    )
    if (line === ctx.line)
      return null
    return { line, changed: true }
  },
}

export const implicitMultiplicationRule: RewriteRule = {
  id: 'implicit-multiplication',
  category: 'semantic-rewrite',
  priority: 600,
  apply: (ctx) => {
    const line = ctx.line.replace(/\b(\d+)\s*\(/g, '$1 * (')
    if (line === ctx.line)
      return null
    return { line, changed: true }
  },
}

export const conditionalsRule: RewriteRule = {
  id: 'conditionals',
  category: 'semantic-rewrite',
  priority: 700,
  apply: (ctx) => {
    const lower = ctx.line.toLowerCase()

    const thenIdx = lower.indexOf(' then ')
    const elseIdx = lower.indexOf(' else ')
    if (/^if\s/i.test(ctx.line) && thenIdx > 2 && elseIdx > thenIdx) {
      const cond = ctx.line.slice(3, thenIdx).trim()
      const thenExpr = ctx.line.slice(thenIdx + 6, elseIdx).trim()
      const elseExpr = ctx.line.slice(elseIdx + 6).trim()
      return {
        line: `(${cond}) ? (${thenExpr}) : (${elseExpr})`,
        changed: true,
      }
    }

    const unlessIdx = lower.indexOf(' unless ')
    if (unlessIdx > 0) {
      const expr = ctx.line.slice(0, unlessIdx).trim()
      const cond = ctx.line.slice(unlessIdx + 8).trim()
      return { line: `(${cond}) ? 0 : (${expr})`, changed: true }
    }

    const ifIdx = lower.indexOf(' if ')
    if (ifIdx > 0) {
      const expr = ctx.line.slice(0, ifIdx).trim()
      const cond = ctx.line.slice(ifIdx + 4).trim()
      return { line: `(${cond}) ? (${expr}) : 0`, changed: true }
    }

    const line = ctx.line.replace(/&&/g, ' and ').replace(/\|\|/g, ' or ')
    if (line === ctx.line)
      return null
    return { line, changed: true }
  },
}

export const wordOperatorsRule: RewriteRule = {
  id: 'word-operators',
  category: 'semantic-rewrite',
  priority: 800,
  apply: (ctx) => {
    const hasConditional = /\?|[><=!]=?|\btrue\b|\bfalse\b/.test(ctx.line)

    let line = ctx.line
      .replace(/\bremainder\s+of\s+(\S+)\s+divided\s+by\s+(\S+)/gi, '$1 % $2')
      .replace(/\bto\s+the\s+power\s+of\b/gi, '^')
      .replace(/\bmultiplied\s+by\b/gi, '*')
      .replace(/\bdivided\s+by\b/gi, '/')
      .replace(/\bdivide\s+by\b/gi, '/')
      .replace(/(\S+)\s+xor\s+(\S+)/gi, 'bitXor($1, $2)')
      .replace(/\btimes\b/gi, '*')
      .replace(/\bdivide\b/gi, '/')
      .replace(/\bplus\b/gi, '+')
      .replace(/\bwith\b/gi, '+')
      .replace(/\bminus\b/gi, '-')
      .replace(/\bsubtract\b/gi, '-')
      .replace(/\bwithout\b/gi, '-')
      .replace(/\bmul\b/gi, '*')
      .replace(/\bmod\b/gi, '%')

    if (!hasConditional) {
      line = line.replace(/\band\b/gi, '+')
    }

    if (line === ctx.line)
      return null
    return { line, changed: true }
  },
}

export const miscPhrasesRule: RewriteRule = {
  id: 'misc-phrases',
  category: 'semantic-rewrite',
  priority: 250,
  apply: (ctx) => {
    const line = ctx.line
      // min/max
      .replace(
        /\b(?:larger|greater)\s+of\s+(\S+)\s+and\s+(\S+)/gi,
        'max($1, $2)',
      )
      .replace(
        /\b(?:smaller|lesser)\s+of\s+(\S+)\s+and\s+(\S+)/gi,
        'min($1, $2)',
      )
      // half / midpoint
      .replace(/\bhalf\s+of\s+(\S+)/gi, '($1 / 2)')
      .replace(
        /\bmidpoint\s+between\s+(\S+)\s+and\s+(\S+)/gi,
        '(($1 + $2) / 2)',
      )
      // random
      .replace(
        /\brandom\s+number\s+between\s+(\S+)\s+and\s+(\S+)/gi,
        'random($1, $2)',
      )
      // gcd / lcm
      .replace(/\bgcd\s+of\s+(\S+)\s+and\s+(\S+)/gi, 'gcd($1, $2)')
      .replace(/\blcm\s+of\s+(\S+)\s+and\s+(\S+)/gi, 'lcm($1, $2)')
      // permutations / combinations
      .replace(/\b(\d+)\s+permutations?\s+of\s+(\d+)/gi, 'permutations($2, $1)')
      .replace(/\b(\d+)\s+combinations?\s+of\s+(\d+)/gi, 'combinations($2, $1)')
      .replace(/\b(\d+)\s+permutation\s+(\d+)/gi, 'permutations($1, $2)')
      .replace(/\b(\d+)\s+combination\s+(\d+)/gi, 'combinations($1, $2)')
      // clamp
      .replace(
        /\bclamp\s+(\S+)\s+between\s+(\S+)\s+and\s+(\S+)/gi,
        'max($2, min($3, $1))',
      )
      .replace(
        /\bclamp\s+(\S+)\s+from\s+(\S+)\s+to\s+(\S+)/gi,
        'max($2, min($3, $1))',
      )
      // proportions (rule of three)
      .replace(
        /(\S+)\s+is\s+to\s+(\S+)\s+as\s+(\S+)\s+is\s+to\s+what/gi,
        '($2 * $3 / $1)',
      )
      .replace(
        /(\S+)\s+is\s+to\s+(\S+)\s+as\s+what\s+is\s+to\s+(\S+)/gi,
        '($1 * $3 / $2)',
      )
    if (line === ctx.line)
      return null
    return { line, changed: true }
  },
}

export const semanticRewriteRules: RewriteRule[] = [
  ratesRule,
  multipliersRule,
  miscPhrasesRule,
  phraseFunctionsRule,
  functionSyntaxRule,
  functionConversionsRule,
  implicitMultiplicationRule,
  conditionalsRule,
  wordOperatorsRule,
]
