import { describe, expect, it } from 'vitest'
import { analysisNormalize } from '../pipeline/analysisNormalize'
import { classify } from '../pipeline/classify'
import { rewrite } from '../pipeline/rewrite'
import { preprocessMathExpression } from '../preprocess'

function rewriteRaw(raw: string): string {
  const view = analysisNormalize(raw)
  const classification = classify(view)
  return rewrite(view, classification)
}

function oldPreprocess(raw: string): string {
  return preprocessMathExpression(raw)
}

describe('rewrite parity with preprocessMathExpression', () => {
  const cases = [
    // Basic arithmetic (no transforms)
    '10 + 5',
    '2 * 3',
    // Grouped numbers
    '5 300',
    // Degree signs
    '45°',
    // Scales
    '2k',
    '3M',
    '1.5 billion',
    // Currency symbols
    '$100',
    '€50',
    // Currency words
    '10 dollars',
    // Word operators
    '8 times 9',
    '10 plus 5',
    '3 multiplied by 4',
    '100 divide by 4',
    '17 mod 5',
    // Unit aliases
    '1 nautical mile',
    // Time units
    '3 days',
    '2 hours',
    // Stacked units
    '1 meter 20 cm',
    // Area/volume
    '20 sq cm',
    'cbm',
    // Percentages
    '15% of 200',
    '200 + 10%',
    '5% on 200',
    '50 as a % of 100',
    // Conversions
    '5 km as mile',
    '100 celsius into fahrenheit',
    // Functions
    'sqrt 16',
    'log 2 (8)',
    // Phrase functions
    'square root of 81',
    'log 20 base 4',
    // Conditionals
    'if 5 > 3 then 10 else 20',
    '42 if 5 > 3',
    // Labels
    'Price: $100 + $50',
    // Quoted text
    '$275 for the "Model 227"',
    // Reverse conversion
    'meters in 10 km',
    // Shorthand
    'km m',
    // Rates
    '$50 per week',
    // Multipliers
    '50 to 75 is what x',
    // Implicit multiplication
    '6(3)',
    // Percentage change
    '50 to 75 is what %',
    '0.35 as %',
    // Additive unit inference
    '$100 + 10',
    '10 USD + 1 in RUB',
    // Power phrase
    '3 to the power of 2',
    'remainder of 21 divided by 5',
    // Fractions
    '2/3 of 600',
  ]

  for (const input of cases) {
    it(`"${input}"`, () => {
      expect(rewriteRaw(input)).toBe(oldPreprocess(input))
    })
  }
})
