export interface LineResult {
  value: string | null
  error: string | null
  showError?: boolean
  numericValue?: number
  type:
    | 'number'
    | 'unit'
    | 'date'
    | 'pending'
    | 'empty'
    | 'comment'
    | 'assignment'
    | 'aggregate'
}

export type CurrencyServiceState = 'loading' | 'ready' | 'unavailable'

export interface CssContext {
  emPx: number
  ppi: number
}

export interface SpecialLineResult {
  lineResult: LineResult
  rawResult: any
}

// --- Pipeline types ---

export interface AnalysisView {
  raw: string
  expression: string
  normalized: string
  label?: string
}

export type PrimaryIntent =
  | 'empty'
  | 'comment'
  | 'aggregate-block'
  | 'aggregate-inline'
  | 'assignment'
  | 'calendar'
  | 'timezone'
  | 'css'
  | 'date-arithmetic'
  | 'math'

export interface RoundingDirective {
  type:
    | 'dp'
    | 'round'
    | 'ceil'
    | 'floor'
    | 'nearest'
    | 'nearestCeil'
    | 'nearestFloor'
  param: number
}

export interface IntentModifiers {
  rounding?: RoundingDirective
  resultFormat?: 'hex' | 'bin' | 'oct' | 'sci' | 'multiplier'
  stripUnit?: 'number' | 'dec' | 'fraction'
}

export interface LineFeatures {
  hasCurrency: boolean
  hasAssignment: boolean
  hasConversion: boolean
  hasDateTokens: boolean
  hasTimezoneTokens: boolean
}

export interface LineClassification {
  primary: PrimaryIntent
  modifiers: IntentModifiers
  features: LineFeatures
  assignmentTarget?: 'math' | 'css' | 'date'
  timezoneOperation?: 'display' | 'difference'
}

export type RewritePhase =
  | 'normalize'
  | 'syntax-rewrite'
  | 'semantic-rewrite'
  | 'finalize'

export interface RewriteContext {
  raw: string
  view: AnalysisView
  line: string
  classification: LineClassification
}

export interface RewriteResult {
  line: string
  changed: boolean
}

export interface RewriteRule {
  id: string
  category: RewritePhase
  priority: number
  apply: (ctx: RewriteContext) => RewriteResult | null
}
