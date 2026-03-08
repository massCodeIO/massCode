export interface LineResult {
  value: string | null
  error: string | null
  showError?: boolean
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
