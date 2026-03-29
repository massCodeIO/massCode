import type {
  AnalysisView,
  IntentModifiers,
  LineClassification,
  LineFeatures,
  RoundingDirective,
} from '../types'
import {
  currencySymbols,
  currencyWordNames,
  SUPPORTED_CURRENCY_CODES,
  timeZoneAliases,
  weightContextPattern,
} from '../constants'

const AGGREGATE_BLOCK_KEYWORDS = new Set([
  'sum',
  'total',
  'average',
  'avg',
  'median',
  'count',
])

const INLINE_AGGREGATE_RE = /^(?:total|sum|average|avg|median|count)\s+of\s+/

const CALENDAR_PREFIXES = [
  /^days\s+(since|till|until)\s/,
  /^days\s+between\s/,
  /^\d+\s+(?:days?|weeks?|months?|years?)\s+(?:from now|ago)$/,
  /^(?:day of the week|weekday)\s+on\s/,
  /^week\s+of\s+year$/,
  /^week\s+number$/,
  /^week\s+number\s+on\s/,
  /^days\s+in\s+/,
  /^\d+\s+(?:days?|weeks?|months?|years?)\s+(?:after|before)\s/,
  /^current\s+timestamp$/,
  /^workdays\s+in\s/,
  /^workdays\s+from\s/,
  /\s+in\s+workdays$/,
  /^\d+\s+workdays?\s+(?:after|before)\s/,
  /^\d{1,2}(?::\d{2})?(?:\s+(?:(?:am|pm)\s+)?|(?:am|pm)\s+)to\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?$/,
  /\s+to\s+timestamp$/,
  /\s+(?:as|to)\s+iso8601$/,
  /^\d{4}-\d{2}-\d{2}t[\d:.]+\s+to\s+date$/,
  /^\d{13,}\s+to\s+date$/,
  // Finance patterns
  /^\$[\d,.]+\s+(?:after|for)\s+\d/,
  /^interest\s+on\s/,
  /^annual\s+return\s+on\s/,
  /^present\s+value\s+of\s/,
  /^(?:daily|monthly|annual|total)\s+(?:repayment|interest)\s+on\s/,
  /^\$[\d,.]+\s+invested\s/,
]

const MONTH_TOKEN_RE
  = /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/
const RELATIVE_DATE_TOKEN_RE = /\b(?:today|tomorrow|yesterday|now)\b/
const ISO_DATE_RE = /\b\d{4}-\d{2}-\d{2}\b/
const CLOCK_RE = /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/

const TIMEZONE_PATTERNS = [
  /^time$/,
  /^time\(\)$/,
  /^now$/,
  /^now\(\)$/,
  /\btime$/,
  /\bnow$/,
  /^time\s+in\s/,
  /^now\s+in\s/,
  /^date\s+in\s/,
]

const TIMEZONE_DIFF_RE = /\s+-\s+(?:\S.*)?\b(?:time|now)\b/
const TIMEZONE_DIFF_BETWEEN_RE = /^(?:time\s+)?difference\s+between\s/

const CSS_ASSIGNMENT_RE = /^(?:ppi|em)\s*=/i
const CSS_CONVERSION_RE = /\b(?:px|pt|em)\b/

const NEAREST_WORDS: Record<string, number> = {
  ten: 10,
  hundred: 100,
  thousand: 1000,
  million: 1000000,
}

function detectRounding(normalized: string): RoundingDirective | undefined {
  let m: RegExpMatchArray | null

  m = normalized.match(/\s+to\s+(\d+)\s+(?:dp|digits?)$/)
  if (m)
    return { type: 'dp', param: Number(m[1]) }

  m = normalized.match(/\s+rounded\s+(up|down)\s+to\s+nearest\s+(\w+)$/)
  if (m) {
    const n = NEAREST_WORDS[m[2]] || Number(m[2])
    if (n > 0)
      return { type: m[1] === 'up' ? 'nearestCeil' : 'nearestFloor', param: n }
  }

  m = normalized.match(/\s+(?:rounded\s+)?to\s+nearest\s+(\w+)$/)
  if (m) {
    const n = NEAREST_WORDS[m[1]] || Number(m[1])
    if (n > 0)
      return { type: 'nearest', param: n }
  }

  m = normalized.match(/\s+rounded\s+(up|down)$/)
  if (m)
    return { type: m[1] === 'up' ? 'ceil' : 'floor', param: 0 }

  if (/\s+rounded$/.test(normalized))
    return { type: 'round', param: 0 }

  return undefined
}

type ResultFormat = NonNullable<IntentModifiers['resultFormat']>
type StripUnit = NonNullable<IntentModifiers['stripUnit']>

const FORMAT_SUFFIXES: Record<string, ResultFormat> = {
  'in hex': 'hex',
  'in bin': 'bin',
  'in oct': 'oct',
  'in sci': 'sci',
  'in scientific': 'sci',
}

const STRIP_SUFFIXES: Record<string, StripUnit> = {
  'as number': 'number',
  'to number': 'number',
  'as decimal': 'dec',
  'to decimal': 'dec',
  'as dec': 'dec',
  'to dec': 'dec',
  'as fraction': 'fraction',
  'to fraction': 'fraction',
  'as timespan': 'timespan',
  'as laptime': 'laptime',
}

const MULTIPLIER_SUFFIXES = ['as multiplier', 'to multiplier']

const MULTIPLIER_PHRASE_RE
  = /\bas\s+x\s+(?:of|off)\b|\bas\s+multiplier\s+(?:of|on)\b|\bis\s+what\s+x\b|\bas\s+x\b/

const BASE_N_RE = /\s+(?:as|to)\s+base\s+(\d+)$/

function detectResultFormat(normalized: string): ResultFormat | undefined {
  for (const [suffix, format] of Object.entries(FORMAT_SUFFIXES)) {
    if (normalized.endsWith(suffix))
      return format
  }
  if (MULTIPLIER_SUFFIXES.some(s => normalized.endsWith(s)))
    return 'multiplier'
  if (MULTIPLIER_PHRASE_RE.test(normalized))
    return 'multiplier'

  const baseMatch = normalized.match(BASE_N_RE)
  if (baseMatch) {
    const base = Number(baseMatch[1])
    if (base === 2)
      return 'bin'
    if (base === 8)
      return 'oct'
    if (base === 16)
      return 'hex'
  }

  // Python-style: hex(...), bin(...)
  if (/^hex\(.*\)$/i.test(normalized))
    return 'hex'
  if (/^bin\(.*\)$/i.test(normalized))
    return 'bin'

  return undefined
}

function detectStripUnit(normalized: string): StripUnit | undefined {
  for (const [suffix, unit] of Object.entries(STRIP_SUFFIXES)) {
    if (normalized.endsWith(suffix))
      return unit
  }
  return undefined
}

function detectFeatures(normalized: string, expression: string): LineFeatures {
  const currencyCodePattern = new RegExp(
    `\\b(${SUPPORTED_CURRENCY_CODES.join('|')})\\b`,
    'i',
  )
  const hasCurrencySymbol = Object.keys(currencySymbols).some(s =>
    expression.includes(s),
  )
  const hasCurrencyCode = currencyCodePattern.test(expression)
  const hasCurrencyWord = Object.keys(currencyWordNames).some((name) => {
    if (!new RegExp(`\\b${name}\\b`, 'i').test(normalized))
      return false

    if (
      (name === 'pound' || name === 'pounds')
      && weightContextPattern.test(normalized)
    ) {
      return false
    }

    return true
  })

  return {
    hasCurrency: hasCurrencySymbol || hasCurrencyCode || hasCurrencyWord,
    hasAssignment: /^[a-z_]\w*\s*=(?!=)/i.test(expression),
    hasConversion: /\b(?:to|in|as|into)\b/.test(normalized),
    hasDateTokens:
      RELATIVE_DATE_TOKEN_RE.test(normalized)
      || MONTH_TOKEN_RE.test(normalized)
      || ISO_DATE_RE.test(normalized),
    hasTimezoneTokens:
      /\b(?:time|now)\b/.test(normalized)
      && (/\bin\b/.test(normalized)
        || Object.keys(timeZoneAliases).some(tz => normalized.includes(tz))),
  }
}

function probeTimezone(normalized: string): boolean {
  const conversionIndex = normalized.lastIndexOf(' in ')
  if (conversionIndex > 0) {
    const source = normalized.slice(0, conversionIndex).trim()
    const target = normalized.slice(conversionIndex + 4).trim()

    const looksLikeTemporalSource
      = /\b(?:time|now)\b/.test(source)
        || CLOCK_RE.test(source)
        || RELATIVE_DATE_TOKEN_RE.test(source)
        || MONTH_TOKEN_RE.test(source)
        || ISO_DATE_RE.test(source)
        || Object.keys(timeZoneAliases).some(tz => source.includes(tz))

    if (looksLikeTemporalSource && /^[a-z/_ ]+$/.test(target)) {
      return true
    }
  }

  return (
    TIMEZONE_PATTERNS.some(re => re.test(normalized))
    || (/\bin\b/.test(normalized) && /\b(?:time|now)\b/.test(normalized))
  )
}

function probeTimezoneDiff(normalized: string): boolean {
  return (
    TIMEZONE_DIFF_RE.test(normalized)
    || TIMEZONE_DIFF_BETWEEN_RE.test(normalized)
  )
}

function probeCalendar(normalized: string): boolean {
  return CALENDAR_PREFIXES.some(re => re.test(normalized))
}

function probeCss(expression: string, normalized: string): boolean {
  if (CSS_ASSIGNMENT_RE.test(expression))
    return true
  return (
    CSS_CONVERSION_RE.test(normalized)
    && /\b(?:to|in|into|as)\b/.test(normalized)
  )
}

function probeDateArithmetic(
  normalized: string,
  features: LineFeatures,
): boolean {
  if (!features.hasDateTokens)
    return false
  return /[+-]/.test(normalized)
}

export function classify(view: AnalysisView): LineClassification {
  const { raw, expression, normalized } = view

  const modifiers: IntentModifiers = {}
  const features = detectFeatures(normalized, expression)

  // Detect modifiers from suffixes
  modifiers.rounding = detectRounding(normalized)
  modifiers.resultFormat = detectResultFormat(normalized)
  modifiers.stripUnit = detectStripUnit(raw.toLowerCase())

  // --- Primary intent probes (most specific first) ---

  if (!raw) {
    return { primary: 'empty', modifiers, features }
  }

  if (raw.startsWith('//') || raw.startsWith('#')) {
    return { primary: 'comment', modifiers, features }
  }

  const normalizedTrimmed = normalized.trim()

  if (AGGREGATE_BLOCK_KEYWORDS.has(normalizedTrimmed)) {
    return { primary: 'aggregate-block', modifiers, features }
  }

  if (INLINE_AGGREGATE_RE.test(normalizedTrimmed)) {
    return { primary: 'aggregate-inline', modifiers, features }
  }

  if (probeCalendar(normalizedTrimmed)) {
    return { primary: 'calendar', modifiers, features }
  }

  if (probeTimezoneDiff(normalizedTrimmed)) {
    return {
      primary: 'timezone',
      modifiers,
      features,
      timezoneOperation: 'difference',
    }
  }

  if (probeTimezone(normalizedTrimmed)) {
    return {
      primary: 'timezone',
      modifiers,
      features,
      timezoneOperation: 'display',
    }
  }

  if (probeCss(expression, normalizedTrimmed)) {
    if (CSS_ASSIGNMENT_RE.test(expression)) {
      return {
        primary: 'assignment',
        modifiers,
        features,
        assignmentTarget: 'css',
      }
    }
    return { primary: 'css', modifiers, features }
  }

  if (features.hasAssignment) {
    if (features.hasDateTokens) {
      return {
        primary: 'assignment',
        modifiers,
        features,
        assignmentTarget: 'date',
      }
    }
    return {
      primary: 'assignment',
      modifiers,
      features,
      assignmentTarget: 'math',
    }
  }

  if (probeDateArithmetic(normalizedTrimmed, features)) {
    return { primary: 'date-arithmetic', modifiers, features }
  }

  return { primary: 'math', modifiers, features }
}
