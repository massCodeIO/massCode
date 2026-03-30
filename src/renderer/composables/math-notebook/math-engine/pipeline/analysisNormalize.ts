import type { AnalysisView } from '../types'
import { knownUnitTokens } from '../constants'

function stripLabel(line: string): { expression: string, label?: string } {
  const match = line.match(/^([a-z][a-z0-9]*(?:\s[a-z0-9]+)*):\s(\S.*)$/i)
  if (match) {
    return { expression: match[2], label: match[1] }
  }
  return { expression: line }
}

function stripQuotedText(line: string): string {
  const stripped = line
    .replace(/"[^"]*"/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (stripped === line) {
    return line
  }

  const tokens = stripped.split(' ')
  while (tokens.length > 1) {
    const lastToken = tokens.at(-1)!.toLowerCase()

    if (!/^[a-z-]+$/i.test(lastToken) || knownUnitTokens.has(lastToken)) {
      break
    }

    tokens.pop()
  }

  return tokens.join(' ')
}

function stripEndOfLineComment(line: string): string {
  // "expr // comment" → "expr" (but not "// full line comment")
  const idx = line.indexOf('//')
  if (idx > 0) {
    return line.slice(0, idx).trim()
  }
  return line
}

function stripParenthesisComments(line: string): string {
  // "$999 (for iPhone 16)" → "$999"
  // Only strip if preceded by space (not function call like sin(...))
  // and contains at least one word character sequence
  return line.replace(/(?<=\s)\((?=[^)]*[a-z]{2})[^)]+\)/gi, '').trim()
}

export function analysisNormalize(raw: string): AnalysisView {
  const trimmed = raw.trim()
  const { expression: afterLabel, label } = stripLabel(trimmed)
  let expression = stripQuotedText(afterLabel)
  expression = stripEndOfLineComment(expression)
  expression = stripParenthesisComments(expression)

  return {
    raw: trimmed,
    expression,
    normalized: expression.toLowerCase(),
    label,
  }
}
