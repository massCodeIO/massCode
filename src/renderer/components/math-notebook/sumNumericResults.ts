import type { LineResult } from '@/composables/math-notebook'

export function sumNumericResults(results: LineResult[]) {
  return results.reduce(
    (sum, result) =>
      result.numericValue != null ? sum + result.numericValue : sum,
    0,
  )
}
