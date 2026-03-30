export const NUM = String.raw`\d+(?:\.\d+)?`

export function coerceToNumber(result: any): number {
  if (typeof result === 'number')
    return result
  if (
    result
    && typeof result === 'object'
    && typeof result.toNumber === 'function'
  ) {
    try {
      return result.toNumber()
    }
    catch {
      return Number.NaN
    }
  }
  return Number(result)
}

export function splitTopLevelAddSub(expression: string) {
  const terms: string[] = []
  const operators: Array<'+' | '-'> = []
  let depth = 0
  let segmentStart = 0

  for (let index = 0; index < expression.length; index++) {
    const char = expression[index]

    if (char === '(') {
      depth += 1
      continue
    }

    if (char === ')') {
      depth = Math.max(0, depth - 1)
      continue
    }

    if (depth !== 0 || (char !== '+' && char !== '-')) {
      continue
    }

    let prevIndex = index - 1
    while (prevIndex >= 0 && /\s/.test(expression[prevIndex])) {
      prevIndex -= 1
    }

    let nextIndex = index + 1
    while (nextIndex < expression.length && /\s/.test(expression[nextIndex])) {
      nextIndex += 1
    }

    if (prevIndex < 0 || nextIndex >= expression.length) {
      continue
    }

    if ('+-*/%^,('.includes(expression[prevIndex])) {
      continue
    }

    terms.push(expression.slice(segmentStart, index).trim())
    operators.push(char as '+' | '-')
    segmentStart = index + 1
  }

  if (operators.length === 0) {
    return null
  }

  terms.push(expression.slice(segmentStart).trim())

  if (terms.some(term => !term)) {
    return null
  }

  return { terms, operators }
}

export function splitByKeyword(line: string, keywords: string[]) {
  const lowerLine = line.toLowerCase()

  for (const keyword of keywords) {
    const index = lowerLine.lastIndexOf(keyword)
    if (index > 0) {
      return [
        line.slice(0, index).trim(),
        line.slice(index + keyword.length).trim(),
      ] as const
    }
  }

  return null
}

export function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a))
  b = Math.abs(Math.round(b))
  while (b) {
    const t = b
    b = a % b
    a = t
  }
  return a
}

export function toFraction(decimal: number): string {
  if (Number.isInteger(decimal))
    return `${decimal}/1`
  const sign = decimal < 0 ? '-' : ''
  const abs = Math.abs(decimal)
  const precision = 1e10
  const numerator = Math.round(abs * precision)
  const denominator = precision
  const divisor = gcd(numerator, denominator)
  return `${sign}${numerator / divisor}/${denominator / divisor}`
}
