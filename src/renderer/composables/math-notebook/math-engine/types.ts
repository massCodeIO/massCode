export interface LineResult {
  value: string | null
  error: string | null
  type:
    | 'number'
    | 'unit'
    | 'date'
    | 'empty'
    | 'comment'
    | 'assignment'
    | 'aggregate'
}

export interface CssContext {
  emPx: number
  ppi: number
}

export interface SpecialLineResult {
  lineResult: LineResult
  rawResult: any
}
