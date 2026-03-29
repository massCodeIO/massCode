import type { DateFormatStyle } from './math-engine/format'
import type {
  CssContext,
  CurrencyServiceState,
  LineResult,
} from './math-engine/types'
import { DEFAULT_EM_IN_PX, DEFAULT_PPI } from './math-engine/constants'
import { createMathInstance } from './math-engine/mathInstance'
import { analysisNormalize } from './math-engine/pipeline/analysisNormalize'
import { classify } from './math-engine/pipeline/classify'
import { evaluateClassifiedLine } from './math-engine/pipeline/evaluate'
import { createLineFormatter } from './math-engine/pipeline/format'

export type { LineResult } from './math-engine/types'

let activeCurrencyRates: Record<string, number> = {}
let currencyServiceState: CurrencyServiceState = 'loading'
let currencyUnavailableMessage = ''
let math = createMathInstance(activeCurrencyRates)

let activeLocale = 'en-US'
let activeDecimalPlaces = 6
let activeDateFormat: DateFormatStyle = 'numeric'

// --- Main composable ---

export function useMathEngine() {
  function evaluateDocument(text: string): LineResult[] {
    const lines = text.split('\n')
    const results: LineResult[] = []
    const scope: Record<string, any> = {
      em: DEFAULT_EM_IN_PX,
      ppi: DEFAULT_PPI,
    }
    const cssContext: CssContext = {
      emPx: DEFAULT_EM_IN_PX,
      ppi: DEFAULT_PPI,
    }
    const currentDate = new Date()

    let prevResult: any
    let numericBlock: number[] = []
    const formatter = createLineFormatter({
      math,
      locale: activeLocale,
      decimalPlaces: activeDecimalPlaces,
      dateFormat: activeDateFormat,
    })

    for (const line of lines) {
      const trimmed = line.trim()
      const view = analysisNormalize(trimmed)
      const classification = classify(view)

      if (prevResult !== undefined) {
        scope.prev = prevResult
      }

      try {
        const evaluated = evaluateClassifiedLine({
          trimmed,
          view,
          classification,
          scope,
          cssContext,
          currentDate,
          numericBlock,
          math,
          formatter,
          currencyServiceState,
          currencyUnavailableMessage,
          activeLocale,
          activeDateFormat,
        })
        results.push(evaluated.lineResult)

        if (evaluated.resetNumericBlock) {
          numericBlock = []
        }

        if (evaluated.resetPrev) {
          prevResult = undefined
          delete scope.prev
          continue
        }
        prevResult = evaluated.rawResult
        if (
          evaluated.numericValue !== undefined
          && evaluated.numericValue !== null
        ) {
          numericBlock.push(evaluated.numericValue)
        }
      }
      catch (error: any) {
        results.push({
          value: null,
          error: error.message || 'Error',
          type: 'empty',
        })
        prevResult = undefined
        delete scope.prev
      }
    }

    return results
  }

  function updateCurrencyRates(rates: Record<string, number>) {
    currencyServiceState = 'ready'
    currencyUnavailableMessage = ''
    activeCurrencyRates = { ...rates }
    math = createMathInstance(activeCurrencyRates)
  }

  function setCurrencyServiceState(
    state: CurrencyServiceState,
    errorMessage = '',
  ) {
    currencyServiceState = state
    currencyUnavailableMessage = state === 'unavailable' ? errorMessage : ''
    if (state !== 'ready') {
      activeCurrencyRates = {}
      math = createMathInstance(activeCurrencyRates)
    }
  }

  function setFormatSettings(
    locale: string,
    decimalPlaces: number,
    dateFormat: DateFormatStyle = 'numeric',
  ) {
    activeLocale = locale
    activeDecimalPlaces = decimalPlaces
    activeDateFormat = dateFormat
  }

  return {
    evaluateDocument,
    setCurrencyServiceState,
    updateCurrencyRates,
    setFormatSettings,
  }
}
