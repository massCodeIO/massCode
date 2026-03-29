import { describe, expect, it } from 'vitest'
import { analysisNormalize } from '../pipeline/analysisNormalize'
import { classify } from '../pipeline/classify'
import { rewrite } from '../pipeline/rewrite'

function rewriteRaw(raw: string): string {
  const view = analysisNormalize(raw)
  const classification = classify(view)
  return rewrite(view, classification)
}

describe('rewrite canonical output', () => {
  const cases = [
    ['10 + 5', '10 + 5'],
    ['2 * 3', '2 * 3'],
    ['5 300', '5300'],
    ['45°', '45 deg'],
    ['2k', '(2 * 1000)'],
    ['3M', '(3 * 1000000)'],
    ['1.5 billion', '(1.5 * 1000000000)'],
    ['$100', '100 USD'],
    ['€50', '50 EUR'],
    ['10 dollars', '10 USD'],
    ['8 times 9', '8 * 9'],
    ['10 plus 5', '10 + 5'],
    ['3 multiplied by 4', '3 * 4'],
    ['100 divide by 4', '100 / 4'],
    ['17 mod 5', '17 % 5'],
    ['1 nautical mile', '1 nauticalmile'],
    ['3 days', '3 mcday'],
    ['2 hours', '2 mchour'],
    ['1 meter 20 cm', '(1 meter + 20 cm)'],
    ['20 sq cm', '20 cm^2'],
    ['cbm', 'm^3'],
    ['15% of 200', '15 / 100 * 200'],
    ['200 + 10%', '200 * (1 + 10 / 100)'],
    ['5% on 200', '200 * (1 + 5 / 100)'],
    ['50 as a % of 100', '(50 / 100) * 100'],
    ['5 km as mile', '5 km to mile'],
    ['100 celsius into fahrenheit', '100 celsius to fahrenheit'],
    ['sqrt 16', 'sqrt(16)'],
    ['log 2 (8)', 'log(8, 2)'],
    ['square root of 81', 'sqrt(81)'],
    ['log 20 base 4', 'log(20, 4)'],
    ['if 5 > 3 then 10 else 20', '(5 > 3) ? (10) : (20)'],
    ['42 if 5 > 3', '(5 > 3) ? (42) : 0'],
    ['Price: $100 + $50', '100 USD + 50 USD'],
    ['$275 for the "Model 227"', '275 USD'],
    ['meters in 10 km', '10 km to meters'],
    ['km m', '1 km to m'],
    ['$50 per week', '50 USD / mcweek'],
    ['50 to 75 is what x', '75 / 50 to multiplier'],
    ['6(3)', '6 * (3)'],
    ['50 to 75 is what %', '((75 - 50) / 50) * 100'],
    ['0.35 as %', '0.35 * 100'],
    ['$100 + 10', '100 USD + 10 USD'],
    ['$100 + 10%', '100 USD + 10 / 100'],
    ['10 USD + 1 in RUB', '(10 USD + 1 USD) to RUB'],
    ['3 to the power of 2', '3 ^ 2'],
    ['remainder of 21 divided by 5', '21 % 5'],
    ['2/3 of 600', '(2 / 3) * 600'],
  ] as const

  for (const [input, expected] of cases) {
    it(`"${input}"`, () => {
      expect(rewriteRaw(input)).toBe(expected)
    })
  }
})
