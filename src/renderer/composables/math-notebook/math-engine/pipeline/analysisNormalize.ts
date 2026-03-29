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

export function analysisNormalize(raw: string): AnalysisView {
  const trimmed = raw.trim()
  const { expression: afterLabel, label } = stripLabel(trimmed)
  const expression = stripQuotedText(afterLabel)

  return {
    raw: trimmed,
    expression,
    normalized: expression.toLowerCase(),
    label,
  }
}
