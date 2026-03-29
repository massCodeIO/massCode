import type {
  AnalysisView,
  CssContext,
  CurrencyServiceState,
  LineClassification,
  LineResult,
} from '../types'
import type { LineFormatter } from './format'

export interface MathEvaluatorInstance {
  evaluate: (expression: string, scope: Record<string, any>) => any
  unit: (value: number, unit: string) => any
}

export interface EvaluateClassifiedLineOptions {
  trimmed: string
  view: AnalysisView
  classification: LineClassification
  scope: Record<string, any>
  cssContext: CssContext
  currentDate: Date
  numericBlock: number[]
  math: MathEvaluatorInstance
  formatter: LineFormatter
  currencyServiceState: CurrencyServiceState
  currencyUnavailableMessage: string
  activeLocale: string
}

export interface EvaluatedLine {
  lineResult: LineResult
  rawResult: any
  numericValue?: number | null
  resetPrev?: boolean
  resetNumericBlock?: boolean
}

export interface MathDeps {
  mathEvaluate: (expression: string, scope: Record<string, any>) => any
  formatResult: LineFormatter['formatResult']
}
