import {
  currencySymbols,
  currencyWordNames,
  knownUnitTokens,
  MATH_UNARY_FUNCTIONS,
  SUPPORTED_CURRENCY_CODES,
  TIME_UNIT_TOKEN_MAP,
  weightContextPattern,
} from './constants'

function preprocessLabels(line: string): string {
  const match = line.match(/^([a-z][a-z0-9]*(?:\s[a-z0-9]+)*):\s(\S.*)$/i)
  if (match)
    return match[2]
  return line
}

function preprocessQuotedText(line: string): string {
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

function sanitizeForCurrencyDetection(line: string) {
  return preprocessQuotedText(preprocessLabels(line))
}

function preprocessGroupedNumbers(line: string): string {
  let result = line.replace(/\b\d{1,3}(?:\s\d{3})+\b/g, match =>
    match.replace(/\s+/g, ''))

  result = result.replace(/\b\d+(?:\s+\d+)+\b/g, match =>
    match.replace(/\s+/g, ''))

  return result
}

function preprocessDegreeSigns(line: string): string {
  return line.replace(/(-?\d+(?:\.\d+)?)\s*°/g, '$1 deg')
}

function preprocessTimeUnits(line: string): string {
  return line.replace(
    /\b(seconds?|minutes?|hours?|days?|weeks?|months?|years?)\b/gi,
    match => TIME_UNIT_TOKEN_MAP[match.toLowerCase()] || match,
  )
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

function preprocessUnitAliases(line: string): string {
  return line
    .replace(/\btea\s+spoons?\b/gi, 'teaspoon')
    .replace(/\btable\s+spoons?\b/gi, 'tablespoon')
    .replace(/\bnautical\s+miles?\b/gi, 'nauticalmile')
}

function preprocessAreaVolumeAliases(line: string): string {
  line = line.replace(/\bsqm\b/gi, 'm^2')
  line = line.replace(/\bcbm\b/gi, 'm^3')

  line = line.replace(
    /(\d+(?:\.\d+)?)\s+(sq|square)\s+([a-z]+)/gi,
    (_, value: string, _prefix: string, unit: string) =>
      `${value} ${normalizePowerUnit(unit)}^2`,
  )
  line = line.replace(
    /(\b(?:in|to|as|into)\s+)(sq|square)\s+([a-z]+)/gi,
    (_, prefix: string, _keyword: string, unit: string) =>
      `${prefix}${normalizePowerUnit(unit)}^2`,
  )
  line = line.replace(
    /(\d+(?:\.\d+)?)\s+(cu|cubic|cb)\s+([a-z]+)/gi,
    (_, value: string, _prefix: string, unit: string) =>
      `${value} ${normalizePowerUnit(unit)}^3`,
  )
  line = line.replace(
    /(\b(?:in|to|as|into)\s+)(cu|cubic|cb)\s+([a-z]+)/gi,
    (_, prefix: string, _keyword: string, unit: string) =>
      `${prefix}${normalizePowerUnit(unit)}^3`,
  )

  return line
}

function preprocessFunctionExpression(expression: string): string {
  const trimmed = expression.trim()
  const openIndex = trimmed.indexOf('(')
  const closeIndex = trimmed.endsWith(')') ? trimmed.length - 1 : -1

  if (openIndex > 0 && closeIndex > openIndex) {
    if (trimmed.toLowerCase().startsWith('root ')) {
      const degree = trimmed.slice(5, openIndex).trim()
      const value = trimmed.slice(openIndex + 1, closeIndex).trim()
      if (degree && value) {
        return `root(${degree}, ${value})`
      }
    }

    if (trimmed.toLowerCase().startsWith('log ')) {
      const base = trimmed.slice(4, openIndex).trim()
      const value = trimmed.slice(openIndex + 1, closeIndex).trim()
      if (base && value) {
        return `log(${value}, ${base})`
      }
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

function preprocessFunctionSyntax(line: string): string {
  const assignmentIndex = line.indexOf('=')
  if (assignmentIndex > 0) {
    const left = line.slice(0, assignmentIndex).trim()
    const right = line.slice(assignmentIndex + 1).trim()

    if (/^[a-z_]\w*$/i.test(left) && right) {
      return `${line.slice(0, assignmentIndex + 1)} ${preprocessFunctionExpression(right)}`
    }
  }

  return preprocessFunctionExpression(line)
}

function preprocessFunctionConversions(line: string): string {
  const unaryFunctionsPattern = MATH_UNARY_FUNCTIONS.join('|')

  return line.replace(
    new RegExp(
      `(^|[=,+\\-*/(]\\s*)(${unaryFunctionsPattern})\\(([^()]+?)\\s+(?:in|to|as|into)\\s+([a-z][a-z0-9^]*)\\)`,
      'gi',
    ),
    (_, prefix: string, fn: string, source: string, target: string) => {
      return `${prefix}${fn}(unitValue(to(${source.trim()}, ${target.trim()})))`
    },
  )
}

function preprocessCurrencySymbols(line: string): string {
  let nextLine = line.replace(
    /R\$\s*(\d+(?:\.\d+)?(?:\s*[kKM])?)\b/g,
    '$1 BRL',
  )

  for (const [symbol, code] of Object.entries(currencySymbols)) {
    if (symbol === 'R$')
      continue

    const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    nextLine = nextLine.replace(
      new RegExp(`${escaped}\\s*(\\d+(?:\\.\\d+)?(?:\\s*(?:k|M))?)\\b`, 'g'),
      `$1 ${code}`,
    )
  }

  return nextLine
}

function preprocessCurrencyWords(line: string): string {
  return line.replace(
    /(\d+(?:\.\d+)?)\s+(dollars?|euros?|pounds?|roubles?|rubles?|yen|yuan|rupees?|reais|real|pesos?)\b/gi,
    (
      _,
      amount: string,
      currencyName: string,
      _offset: number,
      fullLine: string,
    ) => {
      const lowerCurrencyName = currencyName.toLowerCase()

      if (
        (lowerCurrencyName === 'pound' || lowerCurrencyName === 'pounds')
        && weightContextPattern.test(fullLine)
      ) {
        return `${amount} ${currencyName}`
      }

      const code = currencyWordNames[lowerCurrencyName]
      return code ? `${amount} ${code}` : `${amount} ${currencyName}`
    },
  )
}

function splitTopLevelAddSubTerms(expression: string) {
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
    operators.push(char)
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

function extractAdditiveUnit(term: string) {
  const match = term.match(/^-?\d+(?:\.\d+)?\s+([a-z][a-z0-9^]*)$/i)
  if (!match) {
    return null
  }

  return match[1].toUpperCase()
    in Object.fromEntries(SUPPORTED_CURRENCY_CODES.map(code => [code, true]))
    ? match[1].toUpperCase()
    : match[1]
}

function isPlainNumberTerm(term: string) {
  return /^-?\d+(?:\.\d+)?$/.test(term)
}

function inferAdditiveUnitsForPlainNumbers(expression: string) {
  const split = splitTopLevelAddSubTerms(expression)
  if (!split) {
    return expression
  }

  const explicitUnits = split.terms.map(extractAdditiveUnit)

  let changed = false
  const inferredTerms = split.terms.map((term, index) => {
    if (!isPlainNumberTerm(term)) {
      return term
    }

    const previousUnit = explicitUnits.slice(0, index).reverse().find(Boolean)
    const nextUnit = explicitUnits.slice(index + 1).find(Boolean)
    const inheritedUnit = previousUnit || nextUnit

    if (!inheritedUnit) {
      return term
    }

    changed = true
    return `${term} ${inheritedUnit}`
  })

  if (!changed) {
    return expression
  }

  let rebuilt = inferredTerms[0]
  for (let index = 0; index < split.operators.length; index++) {
    rebuilt += ` ${split.operators[index]} ${inferredTerms[index + 1]}`
  }

  return rebuilt
}

function inferAdditiveUnits(line: string): string {
  const conversionSplit = splitByKeyword(line, [
    ' into ',
    ' as ',
    ' to ',
    ' in ',
  ])
  const sourceExpression = conversionSplit ? conversionSplit[0] : line
  const conversionTarget = conversionSplit ? conversionSplit[1] : null

  const inferredSource = inferAdditiveUnitsForPlainNumbers(sourceExpression)
  const hasAdditiveSource = splitTopLevelAddSubTerms(sourceExpression) !== null

  if (!hasAdditiveSource) {
    return line
  }

  if (!conversionTarget) {
    return inferredSource
  }

  const groupedSource = `(${inferredSource})`
  return `${groupedSource} to ${conversionTarget}`
}

function preprocessScales(line: string): string {
  return line
    .replace(/(\d+(?:\.\d+)?)\s*k\b/g, '($1 * 1000)')
    .replace(/(\d+(?:\.\d+)?)\s*M\b/g, '($1 * 1000000)')
    .replace(/(\d+(?:\.\d+)?)\s+billion\b/gi, '($1 * 1000000000)')
    .replace(/(\d+(?:\.\d+)?)\s+million\b/gi, '($1 * 1000000)')
    .replace(/(\d+(?:\.\d+)?)\s+thousand\b/gi, '($1 * 1000)')
}

function preprocessStackedUnits(line: string): string {
  return line.replace(
    /-?\d+(?:\.\d+)?\s+[a-z]+(?:\s+-?\d+(?:\.\d+)?\s+[a-z]+)+/gi,
    (match) => {
      const tokens = match.trim().split(/\s+/)
      const pairs: string[] = []

      for (let index = 0; index < tokens.length; index += 2) {
        if (!/^-?\d+(?:\.\d+)?$/.test(tokens[index])) {
          return match
        }

        const unit = tokens[index + 1]?.toLowerCase()
        if (!unit || !knownUnitTokens.has(unit)) {
          return match
        }

        pairs.push(`${tokens[index]} ${tokens[index + 1]}`)
      }

      return pairs.length >= 2 ? `(${pairs.join(' + ')})` : match
    },
  )
}

function preprocessImplicitMultiplication(line: string): string {
  return line.replace(/(\d)\s*\(/g, '$1 * (')
}

function preprocessWordOperators(line: string): string {
  return line
    .replace(/\bmultiplied\s+by\b/gi, '*')
    .replace(/\bdivide\s+by\b/gi, '/')
    .replace(/(\S+)\s+xor\s+(\S+)/gi, 'bitXor($1, $2)')
    .replace(/\btimes\b/gi, '*')
    .replace(/\bdivide\b/gi, '/')
    .replace(/\bplus\b/gi, '+')
    .replace(/\band\b/gi, '+')
    .replace(/\bwith\b/gi, '+')
    .replace(/\bminus\b/gi, '-')
    .replace(/\bsubtract\b/gi, '-')
    .replace(/\bwithout\b/gi, '-')
    .replace(/\bmul\b/gi, '*')
    .replace(/\bmod\b/gi, '%')
}

function preprocessPercentages(line: string): string {
  return line
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
    .replace(/(\d+(?:\.\d+)?)%\s+on\s+(\d+(?:\.\d+)?)/gi, '$2 * (1 + $1 / 100)')
    .replace(
      /(\d+(?:\.\d+)?)%\s+off\s+(\d+(?:\.\d+)?)/gi,
      '$2 * (1 - $1 / 100)',
    )
    .replace(/(\d+(?:\.\d+)?)%\s+of\s+(\d+(?:\.\d+)?)/gi, '$1 / 100 * $2')
    .replace(/(\d+(?:\.\d+)?)\s*\+\s*(\d+(?:\.\d+)?)%/g, '$1 * (1 + $2 / 100)')
    .replace(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)%/g, '$1 * (1 - $2 / 100)')
    .replace(/(\d+(?:\.\d+)?)%(?!\s*\w)/g, '$1 / 100')
}

function preprocessConversions(line: string): string {
  return line.replace(/\s+as\s+/gi, ' to ').replace(/\s+into\s+/gi, ' to ')
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

export function hasCurrencyExpression(line: string) {
  const sanitized = sanitizeForCurrencyDetection(line)

  if (!sanitized) {
    return false
  }

  if (
    Object.keys(currencySymbols).some(symbol => sanitized.includes(symbol))
  ) {
    return true
  }

  const currencyCodePattern = new RegExp(
    `\\b(${SUPPORTED_CURRENCY_CODES.join('|')})\\b`,
    'i',
  )
  if (currencyCodePattern.test(sanitized)) {
    return true
  }

  return Object.keys(currencyWordNames).some((currencyName) => {
    if (!new RegExp(`\\b${currencyName}\\b`, 'i').test(sanitized)) {
      return false
    }

    if (
      (currencyName === 'pound' || currencyName === 'pounds')
      && weightContextPattern.test(sanitized)
    ) {
      return false
    }

    return true
  })
}

export function preprocessMathExpression(line: string) {
  let processed = preprocessLabels(line)
  processed = preprocessQuotedText(processed)
  processed = preprocessGroupedNumbers(processed)
  processed = preprocessDegreeSigns(processed)
  processed = preprocessTimeUnits(processed)
  processed = preprocessUnitAliases(processed)
  processed = preprocessCurrencySymbols(processed)
  processed = preprocessCurrencyWords(processed)
  processed = preprocessScales(processed)
  processed = preprocessAreaVolumeAliases(processed)
  processed = preprocessStackedUnits(processed)
  processed = preprocessFunctionSyntax(processed)
  processed = preprocessFunctionConversions(processed)
  processed = preprocessImplicitMultiplication(processed)
  processed = preprocessWordOperators(processed)
  processed = inferAdditiveUnits(processed)
  processed = preprocessPercentages(processed)
  processed = preprocessConversions(processed)
  return processed
}
