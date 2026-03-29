/* eslint-disable test/prefer-lowercase-title */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMathEngine } from '../math-notebook/useMathEngine'

const TEST_CURRENCY_RATES = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  CAD: 1.36,
  RUB: 90,
}

const { evaluateDocument, setCurrencyServiceState, updateCurrencyRates }
  = useMathEngine()

function evalLine(expr: string) {
  return evaluateDocument(expr)[0]
}

function evalLines(text: string) {
  return evaluateDocument(text)
}

function expectValue(expr: string, expected: string) {
  const result = evalLine(expr)
  expect(result.value).toBe(expected)
}

function expectNumericClose(expr: string, expected: number, precision = 2) {
  const result = evalLine(expr)
  const num = Number.parseFloat(result.value!.replace(/,/g, ''))
  expect(num).toBeCloseTo(expected, precision)
}

function expectDateWithYear(expr: string, year: string) {
  const result = evalLine(expr)
  expect(result.type).toBe('date')
  expect(result.value).toContain(year)
}

beforeEach(() => {
  updateCurrencyRates(TEST_CURRENCY_RATES)
})

describe('arithmetic', () => {
  it('addition', () => expectValue('10 + 5', '15'))
  it('subtraction', () => expectValue('20 - 3', '17'))
  it('multiplication', () => expectValue('4 * 5', '20'))
  it('division', () => expectValue('100 / 4', '25'))
  it('parentheses', () => expectValue('(2 + 3) * 4', '20'))
  it('exponent', () => expectValue('2 ^ 10', '1,024'))
  it('negative numbers', () => expectValue('-5 + 3', '-2'))
  it('decimal', () => expectValue('0.1 + 0.2', '0.3'))
  it('complex expression', () => expectValue('2 + 3 * 4 - 1', '13'))
  it('implicit multiplication', () => expectValue('6 (3)', '18'))
  it('grouped thousands', () => expectValue('5 300', '5,300'))
  it('grouped thousands with unit suffix', () => {
    const result = evalLine('1km + 1 000m')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('km')
  })
})

describe('rounding', () => {
  it('to 2 dp', () => expectValue('1/3 to 2 dp', '0.33'))
  it('to 5 digits', () => expectValue('pi to 5 digits', '3.14159'))
  it('rounded', () => expectValue('5.5 rounded', '6'))
  it('rounded down', () => expectValue('5.5 rounded down', '5'))
  it('rounded up', () => expectValue('5.5 rounded up', '6'))
  it('to nearest 10', () => expectValue('37 to nearest 10', '40'))
  it('rounded to nearest thousand', () =>
    expectValue('2100 to nearest thousand', '2,000'))
  it('rounded up to nearest 5', () =>
    expectValue('21 rounded up to nearest 5', '25'))
  it('rounded down to nearest 3', () =>
    expectValue('17 rounded down to nearest 3', '15'))
  it('to nearest hundred', () => expectValue('490 to nearest hundred', '500'))
  it('to 0 dp', () => expectValue('3.7 to 0 dp', '4'))
  it('negative rounded', () => expectValue('-5.5 rounded', '-5'))
  it('negative rounded up', () => expectValue('-5.5 rounded up', '-5'))
  it('negative rounded down', () => expectValue('-5.5 rounded down', '-6'))
  it('to nearest 1 (no-op)', () => expectValue('37 to nearest 1', '37'))
  it('pi to 10 digits', () => expectValue('pi to 10 digits', '3.1415926536'))
})

describe('math aliases', () => {
  it('fact', () => expectValue('fact(5)', '120'))
  it('arcsin', () => expectNumericClose('arcsin(1)', Math.PI / 2, 4))
  it('arccos', () => expectNumericClose('arccos(1)', 0, 4))
  it('arctan', () => expectNumericClose('arctan(1)', Math.PI / 4, 4))
  it('root 2 (8)', () => expectNumericClose('root 2 (8)', Math.sqrt(8), 4))
  it('log 2 (8)', () => expectNumericClose('log 2 (8)', 3, 4))
  it('exp(1)', () => expectNumericClose('exp(1)', Math.E, 4))
  it('log2(8)', () => expectNumericClose('log2(8)', 3, 4))
  it('log10(1000)', () => expectNumericClose('log10(1000)', 3, 4))

  // Phrase syntax
  it('square root of 81', () => expectValue('square root of 81', '9'))
  it('cube root of 27', () => expectValue('cube root of 27', '3'))
  it('root 5 of 100', () => expectNumericClose('root 5 of 100', 2.5119, 3))
  it('log 20 base 4', () => expectNumericClose('log 20 base 4', 2.161, 2))
  it('81 is 9 to what power', () =>
    expectNumericClose('81 is 9 to what power', 2, 2))
  it('27 is 3 to the what', () =>
    expectNumericClose('27 is 3 to the what', 3, 2))

  // Degree trig functions
  it('sind(90)', () => expectNumericClose('sind(90)', 1, 4))
  it('cosd(0)', () => expectNumericClose('cosd(0)', 1, 4))
  it('tand(45)', () => expectNumericClose('tand(45)', 1, 4))
  it('asind(0.5)', () => expectNumericClose('asind(0.5)', 30, 4))
  it('acosd(0.5)', () => expectNumericClose('acosd(0.5)', 60, 4))
  it('atand(1)', () => expectNumericClose('atand(1)', 45, 4))
  it('sin(90 degrees)', () => expectNumericClose('sin(90 degrees)', 1, 4))

  // Hyperbolic inverse
  it('asinh(1)', () => expectNumericClose('asinh(1)', 0.8814, 3))
  it('acosh(2)', () => expectNumericClose('acosh(2)', 1.317, 2))
  it('atanh(0.5)', () => expectNumericClose('atanh(0.5)', 0.5493, 3))
})

describe('word operators', () => {
  it('times', () => expectValue('8 times 9', '72'))
  it('plus', () => expectValue('10 plus 5', '15'))
  it('and', () => expectValue('10 and 5', '15'))
  it('with', () => expectValue('10 with 5', '15'))
  it('minus', () => expectValue('20 minus 3', '17'))
  it('subtract', () => expectValue('20 subtract 3', '17'))
  it('without', () => expectValue('20 without 3', '17'))
  it('multiplied by', () => expectValue('3 multiplied by 4', '12'))
  it('divide', () => expectValue('100 divide 4', '25'))
  it('divide by', () => expectValue('100 divide by 4', '25'))
  it('mul', () => expectValue('5 mul 6', '30'))
  it('mod', () => expectValue('17 mod 5', '2'))
  it('to the power of', () => expectValue('3 to the power of 2', '9'))
  it('remainder of X divided by Y', () =>
    expectValue('remainder of 21 divided by 5', '1'))
  it('divided by', () => expectValue('1000 divided by 200', '5'))

  it('does not replace words inside variable names', () => {
    const results = evalLines('width = 100\nwidth * 2')
    expect(results[1].value).toBe('200')
  })
})

describe('variables', () => {
  it('assignment and reuse', () => {
    const results = evalLines('v = 20\nv * 7')
    expect(results[0].value).toBe('20')
    expect(results[0].type).toBe('assignment')
    expect(results[1].value).toBe('140')
  })

  it('multiple variables', () => {
    const results = evalLines('a = 10\nb = 20\na + b')
    expect(results[2].value).toBe('30')
  })

  it('variable with word operator', () => {
    const results = evalLines('v = 20\nv times 7')
    expect(results[1].value).toBe('140')
  })

  it('variable reassignment', () => {
    const results = evalLines('x = 5\nx = 10\nx + 1')
    expect(results[2].value).toBe('11')
  })
})

describe('labels', () => {
  it('strip label and evaluate', () => {
    expectNumericClose('Price: 11 + 34.45', 45.45)
  })

  it('label with currency', () => {
    const result = evalLine('Total: $100')
    expect(result.type).toBe('unit')
  })

  it('label with multi-word', () => {
    expectNumericClose('Monthly cost: 1200 / 12', 100)
  })

  it('no label — colon in time is not a label', () => {
    const result = evalLine('10 + 5')
    expect(result.value).toBe('15')
  })
})

describe('quoted text', () => {
  it('ignores inline quoted fragments', () => {
    const result = evalLine('$275 for the "Model 227"')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('USD')
    expectNumericClose('$275 for the "Model 227"', 275)
  })
})

describe('percentage basic', () => {
  it('X + Y%', () => expectNumericClose('100 + 15%', 115))
  it('X - Y%', () => expectNumericClose('200 - 10%', 180))
  it('Y% of X', () => expectNumericClose('15% of 200', 30))
})

describe('percentage advanced', () => {
  it('Y% on X', () => expectNumericClose('5% on 200', 210))
  it('Y% off X', () => expectNumericClose('5% off 200', 190))
  it('X as a % of Y', () => expectNumericClose('50 as a % of 100', 50))
  it('X as a % on Y', () => expectNumericClose('70 as a % on 20', 250))
  it('X as a % off Y', () => expectNumericClose('20 as a % off 70', 71.43))
  it('Y% of what is X', () => expectNumericClose('5% of what is 6', 120))
  it('Y% on what is X', () => expectNumericClose('5% on what is 6', 5.71))
  it('Y% off what is X', () => expectNumericClose('5% off what is 6', 6.32))

  // Percentage change
  it('X to Y is what %', () => expectNumericClose('50 to 75 is what %', 50))
  it('X to Y as %', () => expectNumericClose('40 to 90 as %', 125))
  it('X is what % off Y', () =>
    expectNumericClose('180 is what % off 200', 10))
  it('X is what % on Y', () => expectNumericClose('180 is what % on 150', 20))
  it('X is what % of Y', () => expectNumericClose('20 is what % of 200', 10))
  it('X as a % of Y (alt)', () => expectNumericClose('20 as a % of 200', 10))

  // Reverse lookup: X is Y% of/on/off what
  it('X is Y% of what', () => expectNumericClose('20 is 10% of what', 200))
  it('X is Y% on what', () => expectNumericClose('220 is 10% on what', 200))
  it('X is Y% off what', () => expectNumericClose('180 is 10% off what', 200))

  // Decimal/fraction to percentage
  it('0.35 as %', () => expectNumericClose('0.35 as %', 35))
  it('X/Y as %', () => expectNumericClose('20/200 as %', 10))
  it('X/Y %', () => expectNumericClose('20/200 %', 10))
  it('0% of 100', () => expectNumericClose('0% of 100', 0))
  it('100% of 250', () => expectNumericClose('100% of 250', 250))
  it('200% of 50', () => expectNumericClose('200% of 50', 100))
  it('100 - 100%', () => expectNumericClose('100 - 100%', 0))
  it('1 as %', () => expectNumericClose('1 as %', 100))
})

describe('fractions', () => {
  it('2/10 as fraction', () => {
    const result = evalLine('2/10 as fraction')
    expect(result.value).toBe('1/5')
  })
  it('50% as fraction', () => {
    const result = evalLine('50% as fraction')
    expect(result.value).toBe('1/2')
  })
  it('0.25 as fraction', () => {
    const result = evalLine('0.25 as fraction')
    expect(result.value).toBe('1/4')
  })
  it('-0.5 as fraction', () => {
    const result = evalLine('-0.5 as fraction')
    expect(result.value).toBe('-1/2')
  })
  it('2/3 of 600', () => expectNumericClose('2/3 of 600', 400))
  it('50 is 1/5 of what', () => expectNumericClose('50 is 1/5 of what', 250))
})

describe('multipliers', () => {
  it('20/5 as multiplier', () => {
    const result = evalLine('20/5 as multiplier')
    expect(result.value).toBe('4x')
  })
  it('50 as x of 5', () => {
    const result = evalLine('50 as x of 5')
    expect(result.value).toBe('10x')
  })
  it('2 as multiplier of 1', () => {
    const result = evalLine('2 as multiplier of 1')
    expect(result.value).toBe('2x')
  })
  it('2 as multiplier on 1', () => {
    const result = evalLine('2 as multiplier on 1')
    expect(result.value).toBe('1x')
  })
  it('1 as x off 2', () => {
    const result = evalLine('1 as x off 2')
    expect(result.value).toBe('0.5x')
  })
  it('50 to 75 is what x', () => {
    const result = evalLine('50 to 75 is what x')
    expect(result.value).toBe('1.5x')
  })
  it('20 to 40 as x', () => {
    const result = evalLine('20 to 40 as x')
    expect(result.value).toBe('2x')
  })
  it('100 to 50 is what x (fractional)', () => {
    const result = evalLine('100 to 50 is what x')
    expect(result.value).toBe('0.5x')
  })
  it('0/5 as multiplier (zero)', () => {
    const result = evalLine('0/5 as multiplier')
    expect(result.value).toBe('0x')
  })
})

describe('scales', () => {
  it('2k', () => {
    const result = evalLine('2k')
    const num = Number.parseFloat(result.value!.replace(/,/g, ''))
    expect(num).toBe(2000)
  })

  it('2 K stays kelvin', () => {
    const result = evalLine('2 K')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('K')
  })

  it('3M (millions)', () => {
    const result = evalLine('3M')
    const num = Number.parseFloat(result.value!.replace(/,/g, ''))
    expect(num).toBe(3000000)
  })

  it('1.5 billion', () => {
    const result = evalLine('1.5 billion')
    const num = Number.parseFloat(result.value!.replace(/,/g, ''))
    expect(num).toBe(1500000000)
  })

  it('10 thousand', () => {
    const result = evalLine('10 thousand')
    const num = Number.parseFloat(result.value!.replace(/,/g, ''))
    expect(num).toBe(10000)
  })

  it('5 million', () => {
    const result = evalLine('5 million')
    const num = Number.parseFloat(result.value!.replace(/,/g, ''))
    expect(num).toBe(5000000)
  })

  it('$2k as currency unit', () => {
    const result = evalLine('$2k')
    expect(result.type).toBe('unit')
  })
})

describe('currency', () => {
  it('waits for currency rates while loading', () => {
    setCurrencyServiceState('loading')

    const result = evalLine('100 USD to EUR')
    expect(result.type).toBe('pending')
    expect(result.value).toBeNull()
  })

  it('shows service unavailable when rates cannot be loaded', () => {
    setCurrencyServiceState(
      'unavailable',
      'Currency rates service unavailable',
    )

    const result = evalLine('100 USD to EUR')
    expect(result.type).toBe('empty')
    expect(result.error).toBe('Currency rates service unavailable')
  })

  it('does not treat pound weight as currency while loading', () => {
    setCurrencyServiceState('loading')

    const result = evalLine('1 pound to lb')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('lb')
  })

  it('$ symbol', () => {
    const result = evalLine('$30')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('USD')
  })

  it('€ symbol', () => {
    const result = evalLine('€50')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('EUR')
  })

  it('£ symbol', () => {
    const result = evalLine('£20')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('GBP')
  })

  it('ISO code', () => {
    const result = evalLine('30 USD')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('USD')
  })

  it('currency addition', () => {
    const result = evalLine('$10 + $20')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('USD')
  })

  it('currency conversion', () => {
    const result = evalLine('100 USD to EUR')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('EUR')
    expectNumericClose('100 USD to EUR', 92)
  })

  it('label with currency', () => {
    const result = evalLine('Price: $11 + $34.45')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('USD')
  })

  it('currency word names', () => {
    const result = evalLine('5 dollars + 10 dollars')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('USD')
    expectNumericClose('5 dollars + 10 dollars', 15)
  })

  it('euros word', () => {
    const result = evalLine('10 euros')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('EUR')
  })

  it('rubles word', () => {
    const result = evalLine('500 rubles')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('RUB')
  })

  it('implicit rate: 4 days * $30', () => {
    const result = evalLine('4 days * $30')
    expect(result.value).toBe('120 USD')
  })

  it('implicit rate: 30 EUR * 4 days', () => {
    const result = evalLine('30 EUR * 4 days')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('EUR')
  })
})

describe('modifier compatibility', () => {
  it('returns controlled error for timezone format modifier', () => {
    const result = evalLine('time in Paris in hex')
    expect(result.type).toBe('empty')
    expect(result.error).toBe(
      'Modifier is not supported for this expression type',
    )
  })

  it('returns controlled error for css rounding modifier', () => {
    const result = evalLine('12 pt in px rounded')
    expect(result.type).toBe('empty')
    expect(result.error).toBe(
      'Modifier is not supported for this expression type',
    )
  })
})

describe('unit conversion', () => {
  it('stacked units', () => {
    const result = evalLine('1 meter 20 cm')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('m')
    expectNumericClose('1 meter 20 cm', 1.2, 2)
  })

  it('stacked units inside addition', () => {
    const result = evalLine('1 meter 20 cm + 1 cm')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('m')
    expectNumericClose('1 meter 20 cm + 1 cm', 1.21, 2)
  })

  it('stacked time units inside addition', () => {
    const result = evalLine('1 hour 20 minutes + 30 minutes')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('hour')
    expectNumericClose('1 hour 20 minutes + 30 minutes', 1.8333, 3)
  })

  it('stacked imperial units inside subtraction', () => {
    const result = evalLine('10 ft 4 inch - 1 inch')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('ft')
    expectNumericClose('10 ft 4 inch - 1 inch', 10.25, 2)
  })

  it('stacked units with conversion', () => {
    const result = evalLine('1 meter 20 cm to cm')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('cm')
    expectNumericClose('1 meter 20 cm to cm', 120, 2)
  })

  it('km to mile', () => {
    const result = evalLine('5 km to mile')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('mile')
  })

  it('celsius to fahrenheit', () => {
    const result = evalLine('100 celsius to fahrenheit')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('fahrenheit')
  })

  it('kg to lb', () => {
    const result = evalLine('1 kg to lb')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('lb')
  })

  it('inch to cm', () => {
    const result = evalLine('1 inch to cm')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('cm')
  })

  it('as is alias for to', () => {
    const result = evalLine('5 km as mile')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('mile')
  })

  it('into is alias for to', () => {
    const result = evalLine('5 km into mile')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('mile')
  })

  it('nautical mile alias', () => {
    const result = evalLine('1 nautical mile to mile')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('mile')
    expectNumericClose('1 nautical mile to mile', 1.15078, 4)
  })

  it('centner alias', () => {
    const result = evalLine('1 centner to kg')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('kg')
    expectNumericClose('1 centner to kg', 100, 2)
  })

  it('pound alias', () => {
    const result = evalLine('1 pound to lb')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('lb')
    expectNumericClose('1 pound to lb', 1, 2)
  })

  it('carat alias', () => {
    const result = evalLine('1 carat to gram')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('gram')
    expectNumericClose('1 carat to gram', 0.2, 2)
  })

  // Speed
  it('60 mph to m/s', () => {
    const result = evalLine('60 mph to m/s')
    expect(result.type).toBe('unit')
    expectNumericClose('60 mph to m/s', 26.82, 1)
  })
  it('100 km/h to mph', () => {
    const result = evalLine('100 km/h to mph')
    expect(result.type).toBe('unit')
    expectNumericClose('100 km/h to mph', 62.14, 1)
  })
  it('10 knots to km/h', () => {
    expectNumericClose('10 knots to kmh', 18.52, 1)
  })

  // Energy
  it('1000 cal to J', () => {
    expectNumericClose('1000 calorie to J', 4184, 0)
  })
  it('1 kcal to calorie', () => {
    expectNumericClose('1 kcal to calorie', 1000, 0)
  })

  // Maritime & Astro
  it('1 fathom to m', () => {
    expectNumericClose('1 fathom to m', 1.8288, 3)
  })
  it('1 light year to km', () => {
    const result = evalLine('1 light year to km')
    expect(result.type).toBe('unit')
  })

  // Mass
  it('1000 mcg to gram', () => {
    expectNumericClose('1000 mcg to gram', 0.001, 4)
  })

  // Volume
  it('1 bushel to liter', () => {
    expectNumericClose('1 bushel to liter', 35.24, 1)
  })

  // Frequency (native math.js)
  it('1 kHz to Hz', () => {
    expectNumericClose('1 kHz to Hz', 1000, 0)
  })

  // Power (native math.js)
  it('1 hp to W', () => {
    expectNumericClose('1 hp to W', 745.7, 0)
  })

  // Data IEC (native math.js)
  it('1 GiB to MiB', () => {
    expectNumericClose('1 GiB to MiB', 1024, 0)
  })

  // Angle
  it('90 deg to rad', () => {
    expectNumericClose('90 deg to rad', 1.5708, 3)
  })

  // Reverse conversion syntax
  it('meters in 10 km', () => {
    expectNumericClose('meters in 10 km', 10000, 0)
  })
  it('days in 3 weeks', () => {
    expectNumericClose('days in 3 weeks', 21, 0)
  })

  // Shorthand conversion
  it('km m (shorthand)', () => {
    expectNumericClose('km m', 1000, 0)
  })

  // Larger unit wins (native math.js)
  it('1km + 1000m = 2 km', () => {
    const result = evalLine('1 km + 1000 m')
    expect(result.value).toContain('km')
  })

  // Area from multiplication (native math.js)
  it('10m * 10m = area', () => {
    const result = evalLine('10 m * 10 m')
    expect(result.type).toBe('unit')
  })
})

describe('rates', () => {
  it('$50/week * 12 weeks', () => {
    const result = evalLine('$50/week * 12 weeks')
    expect(result.type).toBe('unit')
  })
  it('30 hours at $30/hour', () => {
    const result = evalLine('30 hours at $30/hour')
    expect(result.type).toBe('unit')
  })
  it('implicit rate: $30 * 4 days = $120', () => {
    const result = evalLine('$30 * 4 days')
    expect(result.value).toBe('120 USD')
    expect(result.type).toBe('unit')
  })
  it('$99 per week * 4 weeks', () => {
    const result = evalLine('$99 per week * 4 weeks')
    expect(result.type).toBe('unit')
  })
})

describe('css units', () => {
  it('pt to px', () => expectNumericClose('12 pt in px', 16, 1))
  it('pt into px', () => expectNumericClose('12 pt into px', 16, 1))

  it('custom em', () => {
    const results = evalLines('em = 20px\n1.2 em in px')
    expect(results[0].type).toBe('assignment')
    expect(results[0].value).toBe('20 px')
    expectCloseInResults(results[1], 24)
  })

  it('custom ppi', () => {
    const results = evalLines('ppi = 326\n1 cm in px')
    expect(results[0].type).toBe('assignment')
    expect(results[0].value).toBe('326')
    expectCloseInResults(results[1], 128.35)
  })
})

describe('math functions', () => {
  it('sqrt without parentheses', () => expectValue('sqrt 16', '4'))
  it('round without parentheses', () => expectValue('round 3.45', '3'))
  it('cbrt without parentheses', () => expectValue('cbrt 8', '2'))
  it('sqrt', () => expectValue('sqrt(16)', '4'))
  it('abs', () => expectValue('abs(-42)', '42'))
  it('round', () => expectValue('round(3.7)', '4'))
  it('ceil', () => expectValue('ceil(3.2)', '4'))
  it('floor', () => expectValue('floor(3.9)', '3'))

  it('sin(45 deg)', () => expectNumericClose('sin(45 deg)', 0.7071))
  it('sin 45°', () => expectNumericClose('sin 45°', 0.7071))
  it('cos(pi)', () => expectNumericClose('cos(pi)', -1))
  it('log(100)', () => {
    const result = evalLine('log(100)')
    expect(result.error).toBeNull()
    expect(result.value).not.toBeNull()
  })
  it('ln(e)', () => expectNumericClose('ln(e)', 1))
  it('round(1 month in days)', () =>
    expectValue('round(1 month in days)', '30'))
  it('round 1 month in days', () => expectValue('round 1 month in days', '30'))
})

describe('strict time semantics', () => {
  it('1 month in days', () =>
    expectNumericClose('1 month in days', 365 / 12, 3))
  it('1 year in days', () => expectNumericClose('1 year in days', 365, 3))
  it('2 hours + 30 minutes', () =>
    expectNumericClose('2 hours + 30 minutes', 2.5, 2))
})

describe('number format', () => {
  it('in hex', () => {
    const result = evalLine('255 in hex')
    expect(result.value).toBe('0xFF')
  })

  it('in bin', () => {
    const result = evalLine('10 in bin')
    expect(result.value).toBe('0b1010')
  })

  it('in oct', () => {
    const result = evalLine('255 in oct')
    expect(result.value).toBe('0o377')
  })

  it('in sci', () => {
    const result = evalLine('5300 in sci')
    expect(result.value).toBe('5.3e+3')
  })

  it('grouped thousands in sci', () => {
    const result = evalLine('5 300 in sci')
    expect(result.value).toBe('5.3e+3')
  })

  it('in scientific', () => {
    const result = evalLine('5300 in scientific')
    expect(result.value).toBe('5.3e+3')
  })

  it('hex input', () => expectValue('0xFF', '255'))
  it('binary input', () => expectValue('0b1010', '10'))
  it('octal input', () => expectValue('0o377', '255'))
  it('scientific notation input 1e5', () => expectValue('1e5', '100,000'))
  it('scientific notation input 2.5e3', () => expectValue('2.5e3', '2,500'))

  it('0xFF in hex roundtrip', () => {
    const result = evalLine('0xFF in hex')
    expect(result.value).toBe('0xFF')
  })

  it('$100 as number', () => {
    const result = evalLine('$100 as number')
    expect(result.numericValue).toBe(100)
  })

  it('20% as dec', () => {
    const result = evalLine('20% as dec')
    expect(result.value).toBe('0.2')
  })

  it('50% to decimal', () => {
    const result = evalLine('50% to decimal')
    expect(result.value).toBe('0.5')
  })

  it('0 in hex', () => expectValue('0 in hex', '0x0'))
  it('0 in bin', () => expectValue('0 in bin', '0b0'))
  it('0.001 in sci', () => expectValue('0.001 in sci', '1e-3'))
  it('0xFF + 0b1010', () => expectValue('0xFF + 0b1010', '265'))

  it('as base 8', () => {
    const result = evalLine('0b101101 as base 8')
    expect(result.value).toBe('0o55')
  })

  it('as base 2', () => {
    const result = evalLine('0x2D as base 2')
    expect(result.value).toBe('0b101101')
  })

  it('hex(99)', () => {
    const result = evalLine('hex(99)')
    expect(result.value).toBe('0x63')
  })

  it('bin(0x73)', () => {
    const result = evalLine('bin(0x73)')
    expect(result.value).toBe('0b1110011')
  })

  it('int(0o55)', () => {
    const result = evalLine('int(0o55)')
    expect(result.value).toBe('45')
  })
})

describe('numericValue for total', () => {
  it('sets numericValue for plain number', () => {
    const result = evalLine('42')
    expect(result.numericValue).toBe(42)
  })

  it('sets numericValue for arithmetic result', () => {
    const result = evalLine('10 + 5')
    expect(result.numericValue).toBe(15)
  })

  it('sets numericValue for number assignment', () => {
    const results = evalLines('x = 10')
    expect(results[0].numericValue).toBe(10)
  })

  it('does not set numericValue for date', () => {
    const result = evalLine('now')
    expect(result.numericValue).toBeUndefined()
  })

  it('does not set numericValue for date assignment', () => {
    const results = evalLines('x = 12.03.2025')
    expect(results[0].numericValue).toBeUndefined()
  })

  it('does not set numericValue for unit result', () => {
    const result = evalLine('10 USD')
    expect(result.numericValue).toBeUndefined()
  })

  it('does not set numericValue for unit assignment', () => {
    const results = evalLines('price = 10 USD')
    expect(results[0].numericValue).toBeUndefined()
  })

  it('sets intValue for hex format', () => {
    const result = evalLine('255 in hex')
    expect(result.numericValue).toBe(255)
  })

  it('sets intValue (rounded) for hex with float', () => {
    const result = evalLine('10.6 in hex')
    expect(result.numericValue).toBe(11)
  })

  it('sets intValue for bin format', () => {
    const result = evalLine('255 in bin')
    expect(result.numericValue).toBe(255)
  })

  it('sets intValue for oct format', () => {
    const result = evalLine('255 in oct')
    expect(result.numericValue).toBe(255)
  })

  it('sets numericValue for sci format', () => {
    const result = evalLine('5300 in sci')
    expect(result.numericValue).toBe(5300)
  })

  it('does not set numericValue for Infinity', () => {
    const result = evalLine('1/0')
    expect(result.numericValue).toBeUndefined()
  })
})

describe('area and volume aliases', () => {
  it('sq alias', () => {
    const result = evalLine('20 sq cm to cm^2')
    expect(result.type).toBe('unit')
    expectNumericClose('20 sq cm to cm^2', 20, 2)
  })

  it('square alias', () => {
    const result = evalLine('30 square inches to inch^2')
    expect(result.type).toBe('unit')
    expectNumericClose('30 square inches to inch^2', 30, 2)
  })

  it('sqm alias', () => {
    const result = evalLine('11 sqm to m^2')
    expect(result.type).toBe('unit')
    expectNumericClose('11 sqm to m^2', 11, 2)
  })

  it('cubic alias', () => {
    const result = evalLine('30 cubic inches to inch^3')
    expect(result.type).toBe('unit')
    expectNumericClose('30 cubic inches to inch^3', 30, 2)
  })

  it('cbm alias', () => {
    const result = evalLine('11 cbm to m^3')
    expect(result.type).toBe('unit')
    expectNumericClose('11 cbm to m^3', 11, 2)
  })
})

describe('long-tail units', () => {
  it('point', () => expectNumericClose('1 point to inch', 1 / 72, 4))
  it('line', () => expectNumericClose('1 line to inch', 1 / 12, 4))
  it('hand', () => expectNumericClose('1 hand to inch', 4, 4))
  it('rod', () => expectNumericClose('1 rod to ft', 16.5, 4))
  it('chain', () => expectNumericClose('1 chain to ft', 66, 4))
  it('furlong', () => expectNumericClose('1 furlong to mile', 0.125, 4))
  it('cable', () => expectNumericClose('1 cable to m', 185.2, 4))
  it('league', () => expectNumericClose('1 league to mile', 3, 4))
  it('are', () => expectNumericClose('1 are to m^2', 100, 4))
  it('tea spoon alias', () =>
    expectNumericClose('1 tea spoon to teaspoon', 1, 4))
  it('table spoon alias', () =>
    expectNumericClose('1 table spoon to tablespoon', 1, 4))
  it('degree to radian', () =>
    expectNumericClose('1 degree to radian', Math.PI / 180, 4))
  it('radian to degree', () =>
    expectNumericClose('1 radian to degree', 180 / Math.PI, 4))
})

describe('prev', () => {
  it('references previous line result', () => {
    const results = evalLines('10 + 5\nprev * 2')
    expect(results[0].value).toBe('15')
    expect(results[1].value).toBe('30')
  })

  it('chain prev across multiple lines', () => {
    const results = evalLines('10\nprev + 5\nprev * 2')
    expect(results[0].value).toBe('10')
    expect(results[1].value).toBe('15')
    expect(results[2].value).toBe('30')
  })

  it('prev resets after empty line', () => {
    const results = evalLines('10\n\nprev + 5')
    expect(results[0].value).toBe('10')
    expect(results[1].type).toBe('empty')
    expect(results[2].error).not.toBeNull()
  })

  it('prev - 10', () => {
    const results = evalLines('75\nprev - 10')
    expect(results[1].value).toBe('65')
  })

  it('date prev + 1 day', () => {
    const results = evalLines('fromunix(1446587186)\nprev + 1 day')
    expect(results[1].type).toBe('date')
    expect(results[1].value).toBe(
      new Date((1446587186 + 86400) * 1000).toLocaleString('en-US'),
    )
  })
})

describe('sum and total', () => {
  it('sum of lines above', () => {
    const results = evalLines('10 + 5\n20 * 3\nsum')
    expect(results[0].value).toBe('15')
    expect(results[1].value).toBe('60')
    expect(results[2].value).toBe('75')
    expect(results[2].type).toBe('aggregate')
  })

  it('total is alias for sum', () => {
    const results = evalLines('10\n20\n30\ntotal')
    expect(results[3].value).toBe('60')
  })

  it('sum resets after empty line', () => {
    const results = evalLines('10\n20\n\n5\n15\nsum')
    expect(results[5].value).toBe('20')
  })

  it('sum of zero lines', () => {
    const results = evalLines('\nsum')
    expect(results[1].value).toBe('0')
  })

  it('case insensitive', () => {
    const results = evalLines('10\n20\nSUM')
    expect(results[2].value).toBe('30')
  })
})

describe('adjacent digit concatenation', () => {
  it('concatenates space-separated digits', () => {
    expectValue('1 1 2', '112')
  })

  it('works with operators before grouped digits', () => {
    expectValue('1 + 1 + 1 1 2', '114')
  })

  it('concatenates two digit groups', () => {
    expectValue('1 0 + 2 0', '30')
  })

  it('does not break thousands grouping', () => {
    expectValue('4 500', '4,500')
  })

  it('does not break stacked units', () => {
    const result = evalLine('1 meter 20 cm')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('1.2')
  })
})

describe('mixed currency and plain number', () => {
  it('adds plain number to currency in addition', () => {
    const result = evalLine('$100 + 10')
    expect(result.value).toContain('110')
    expect(result.type).toBe('unit')
  })

  it('adds plain number to currency with multiple terms', () => {
    const result = evalLine('$100 + $200 + 10')
    expect(result.value).toContain('310')
    expect(result.type).toBe('unit')
  })

  it('adds plain number before currency', () => {
    const result = evalLine('10 + $100')
    expect(result.value).toContain('110')
    expect(result.type).toBe('unit')
  })

  it('subtracts plain number from currency', () => {
    const result = evalLine('$100 - 10')
    expect(result.value).toContain('90')
    expect(result.type).toBe('unit')
  })

  it('does not modify multiplication with plain number', () => {
    const result = evalLine('$100 * 2')
    expect(result.value).toContain('200')
    expect(result.type).toBe('unit')
  })

  it('does not modify division with plain number', () => {
    const result = evalLine('$100 / 4')
    expect(result.value).toContain('25')
    expect(result.type).toBe('unit')
  })

  it('does not modify expression without currency', () => {
    expectValue('10 + 20', '30')
  })

  it('works with word operator plus', () => {
    const result = evalLine('$100 plus 10')
    expect(result.value).toContain('110')
    expect(result.type).toBe('unit')
  })

  it('works with word operator minus', () => {
    const result = evalLine('$100 minus 10')
    expect(result.value).toContain('90')
    expect(result.type).toBe('unit')
  })

  it('keeps trailing conversion on the whole inferred expression', () => {
    const result = evalLine('10 USD + 1 in RUB')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('RUB')
    expectNumericClose('10 USD + 1 in RUB', 990, 2)
  })
})

describe('mixed unit and plain number', () => {
  it('adds plain number to day unit', () => {
    const result = evalLine('10 day + 34')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('day')
    expectNumericClose('10 day + 34', 44, 2)
  })

  it('adds plain number before day unit', () => {
    const result = evalLine('34 + 10 day')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('day')
    expectNumericClose('34 + 10 day', 44, 2)
  })

  it('adds plain number after adjacent digit concatenation with unit', () => {
    const result = evalLine('1 0 day + 34')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('day')
    expectNumericClose('1 0 day + 34', 44, 2)
  })
})

describe('average and avg', () => {
  it('average of lines above', () => {
    const results = evalLines('10\n20\n30\naverage')
    expect(results[3].value).toBe('20')
    expect(results[3].type).toBe('aggregate')
  })

  it('avg is alias', () => {
    const results = evalLines('10\n20\n30\navg')
    expect(results[3].value).toBe('20')
  })

  it('average resets after empty line', () => {
    const results = evalLines('10\n20\n\n100\naverage')
    expect(results[4].value).toBe('100')
  })

  it('case insensitive', () => {
    const results = evalLines('10\n30\nAVERAGE')
    expect(results[2].value).toBe('20')
  })
})

describe('median', () => {
  it('median of odd count', () => {
    const results = evalLines('10\n20\n30\nmedian')
    expect(results[3].value).toBe('20')
    expect(results[3].type).toBe('aggregate')
  })

  it('median of even count', () => {
    const results = evalLines('10\n20\n30\n40\nmedian')
    expect(results[4].value).toBe('25')
  })

  it('median resets after empty line', () => {
    const results = evalLines('10\n20\n\n100\nmedian')
    expect(results[4].value).toBe('100')
  })
})

describe('count', () => {
  it('count of lines above', () => {
    const results = evalLines('10\n20\n30\ncount')
    expect(results[3].value).toBe('3')
    expect(results[3].type).toBe('aggregate')
  })

  it('count resets after empty line', () => {
    const results = evalLines('10\n20\n\n5\ncount')
    expect(results[4].value).toBe('1')
  })
})

describe('inline aggregates', () => {
  it('total of list', () => expectValue('total of 3, 4, 7 and 9', '23'))
  it('average of list', () =>
    expectNumericClose('average of 36, 42, 19 and 81', 44.5))
  it('count of list', () => expectValue('count of 1, 2, 3, 4, 5', '5'))
  it('median of list', () => expectValue('median of 10, 20 and 30', '20'))
  it('sum of list', () => expectValue('sum of 10, 20, 30', '60'))
})

describe('comments', () => {
  it('// comment', () => {
    const result = evalLine('// This is a comment')
    expect(result.type).toBe('comment')
    expect(result.value).toBeNull()
  })

  it('# comment', () => {
    const result = evalLine('# This is a header')
    expect(result.type).toBe('comment')
    expect(result.value).toBeNull()
  })

  it('comment does not break prev', () => {
    const results = evalLines('10\n// comment\nprev + 5')
    expect(results[0].value).toBe('10')
    expect(results[1].type).toBe('comment')
    expect(results[2].value).toBe('15')
  })

  it('comment does not affect sum', () => {
    const results = evalLines('10\n// comment\n20\nsum')
    expect(results[3].value).toBe('30')
  })
})

describe('empty lines', () => {
  it('empty line produces empty result', () => {
    const result = evalLine('')
    expect(result.type).toBe('empty')
    expect(result.value).toBeNull()
  })

  it('whitespace-only line is empty', () => {
    const result = evalLine('   ')
    expect(result.type).toBe('empty')
    expect(result.value).toBeNull()
  })
})

describe('fromunix', () => {
  it('converts unix timestamp to date', () => {
    const result = evalLine('fromunix(1446587186)')
    expect(result.type).toBe('date')
    expect(result.value).not.toBeNull()
  })

  it('fromunix(0) is epoch', () => {
    const result = evalLine('fromunix(0)')
    expect(result.type).toBe('date')
    expect(result.value).toContain('1970')
  })

  it('fromunix + 2 day', () => {
    const result = evalLine('fromunix(1446587186) + 2 day')
    expect(result.type).toBe('date')
    expect(result.value).toBe(
      new Date((1446587186 + 2 * 86400) * 1000).toLocaleString('en-US'),
    )
  })

  it('date variable + 2 day', () => {
    const results = evalLines('d = fromunix(1446587186)\nd + 2 day')
    expect(results[0].type).toBe('assignment')
    expect(results[1].type).toBe('date')
    expect(results[1].value).toBe(
      new Date((1446587186 + 2 * 86400) * 1000).toLocaleString('en-US'),
    )
  })

  it('local dotted date assignment + 2 day', () => {
    const results = evalLines('x = 12.03.2025\nx + 2 day')
    expect(results[0].type).toBe('assignment')
    expect(results[0].value).toBe(
      new Date(2025, 2, 12).toLocaleString('en-US'),
    )
    expect(results[1].type).toBe('date')
    expect(results[1].value).toBe(
      new Date(2025, 2, 14).toLocaleString('en-US'),
    )
  })
})

describe('time zones', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-06T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('PST time', () => {
    const result = evalLine('PST time')
    expect(result.type).toBe('date')
    expect(result.value).not.toBeNull()
  })

  it('time()', () => {
    const result = evalLine('time()')
    expect(result.type).toBe('date')
    expect(result.value).not.toBeNull()
  })

  it('time() + 1 day', () => {
    const result = evalLine('time() + 1 day')
    expect(result.type).toBe('date')
    expect(result.value).toBe(
      new Date('2026-03-07T12:00:00Z').toLocaleString('en-US'),
    )
  })

  it('now()', () => {
    const result = evalLine('now()')
    expect(result.type).toBe('date')
    expect(result.value).not.toBeNull()
  })

  it('now + 1 day', () => {
    const result = evalLine('now + 1 day')
    expect(result.type).toBe('date')
    expect(result.value).toBe(
      new Date('2026-03-07T12:00:00Z').toLocaleString('en-US'),
    )
  })

  it('Time in Madrid', () => {
    const result = evalLine('Time in Madrid')
    expect(result.type).toBe('date')
    expect(result.value).not.toBeNull()
  })

  it('now in Madrid', () => {
    const result = evalLine('now in Madrid')
    expect(result.type).toBe('date')
    expect(result.value).not.toBeNull()
  })

  it('Berlin now', () => {
    const result = evalLine('Berlin now')
    expect(result.type).toBe('date')
    expect(result.value).not.toBeNull()
  })

  it('PST time - Berlin time', () => {
    const result = evalLine('PST time - Berlin time')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('hour')
    expectNumericClose('PST time - Berlin time', -9, 2)
  })

  it('2:30 pm HKT in Berlin', () => {
    const result = evalLine('2:30 pm HKT in Berlin')
    expect(result.type).toBe('date')
    expect(result.value).not.toBeNull()
  })

  it('2:30 pm New York in Berlin', () => {
    const result = evalLine('2:30 pm New York in Berlin')
    expect(result.type).toBe('date')
    expect(result.value).not.toBeNull()
  })

  it('2026-03-06 PST in Berlin', () => {
    expectDateWithYear('2026-03-06 PST in Berlin', '2026')
  })

  it('2026-03-06 2:30 pm PST in Berlin', () => {
    expectDateWithYear('2026-03-06 2:30 pm PST in Berlin', '2026')
  })

  it('Mar 6 2026 PST in Berlin', () => {
    expectDateWithYear('Mar 6 2026 PST in Berlin', '2026')
  })

  it('2:30 pm Mar 6 2026 PST in Berlin', () => {
    expectDateWithYear('2:30 pm Mar 6 2026 PST in Berlin', '2026')
  })

  it('tomorrow PST in Berlin', () => {
    expectDateWithYear('tomorrow PST in Berlin', '2026')
  })

  it('airport code: 7:30am LAX in Japan', () => {
    const result = evalLine('7:30 am LAX in Japan')
    expect(result.type).toBe('date')
    expect(result.value).not.toBeNull()
  })

  it('country name: time in Thailand', () => {
    const result = evalLine('time in Thailand')
    expect(result.type).toBe('date')
    expect(result.value).not.toBeNull()
  })

  it('country name: time in Germany', () => {
    const result = evalLine('time in Germany')
    expect(result.type).toBe('date')
    expect(result.value).not.toBeNull()
  })

  it('date in Vancouver', () => {
    const result = evalLine('date in Vancouver')
    expect(result.type).toBe('date')
    expect(result.value).not.toBeNull()
  })

  it('time difference between Seattle and Moscow (positive)', () => {
    const result = evalLine('time difference between Seattle and Moscow')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('hour')
    expect(result.value).not.toContain('-')
  })

  it('time difference between Moscow and Seattle (negative)', () => {
    const result = evalLine('time difference between Moscow and Seattle')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('-')
    expect(result.value).toContain('hour')
  })

  it('difference between PDT & AEST', () => {
    const result = evalLine('difference between PDT & AEST')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('hour')
  })
})

describe('constants', () => {
  it('pi', () => expectNumericClose('pi', 3.14159, 4))
  it('e', () => expectNumericClose('e', 2.71828, 4))
  it('tau', () => expectNumericClose('tau', 6.28318, 4))
  it('phi', () => expectNumericClose('phi', 1.61803, 4))
})

describe('conditional logic', () => {
  it('if-then-else (true branch)', () =>
    expectValue('if 5 > 3 then 10 else 20', '10'))
  it('if-then-else (false branch)', () =>
    expectValue('if 5 < 3 then 10 else 20', '20'))
  it('comparison ==', () => expectValue('5 == 5', 'true'))
  it('comparison !=', () => expectValue('5 != 3', 'true'))
  it('comparison >', () => expectValue('5 > 3', 'true'))
  it('comparison <', () => expectValue('5 < 3', 'false'))
  it('comparison >=', () => expectValue('5 >= 5', 'true'))
  it('comparison <=', () => expectValue('3 <= 5', 'true'))
  it('boolean true', () => expectValue('true', 'true'))
  it('boolean false', () => expectValue('false', 'false'))
  it('and operator', () => expectValue('true and false', 'false'))
  it('or operator', () => expectValue('true or false', 'true'))
  it('&& operator', () => expectValue('true && false', 'false'))
  it('|| operator', () => expectValue('true || false', 'true'))
  it('compound condition', () => expectValue('5 > 3 and 10 > 7', 'true'))
  it('boolean assignment', () => {
    const results = evalLines('x = true\nx and false')
    expect(results[1].value).toBe('false')
  })
  it('postfix if', () => expectValue('42 if 5 > 3', '42'))
  it('postfix if (false)', () => expectValue('42 if 5 < 3', '0'))
  it('postfix unless', () => expectValue('42 unless 5 > 3', '0'))
  it('postfix unless (false)', () => expectValue('42 unless 5 < 3', '42'))
  it('if with and', () => expectValue('if true and false then 1 else 2', '2'))
  it('expression in postfix if', () => expectValue('10 + 5 if 3 > 2', '15'))
  it('expression in condition', () =>
    expectValue('if 5 + 3 > 7 then 10 else 20', '10'))
})

describe('bitwise operations', () => {
  it('AND', () => expectValue('5 & 3', '1'))
  it('OR', () => expectValue('5 | 3', '7'))
  it('XOR', () => expectValue('5 xor 3', '6'))
  it('left shift', () => expectValue('1 << 4', '16'))
  it('right shift', () => expectValue('16 >> 2', '4'))
})

describe('calendar calculations', () => {
  it('days since a date', () => {
    const result = evalLine('days since January 1')
    expect(result.value).toContain('day')
    expect(result.numericValue).toBeGreaterThan(0)
  })

  it('days till a date', () => {
    const result = evalLine('days till December 25')
    expect(result.value).toContain('day')
    expect(result.numericValue).toBeGreaterThan(0)
  })

  it('days between two dates', () => {
    const result = evalLine('days between March 1 and March 31')
    expect(result.value).toBe('30 days')
    expect(result.numericValue).toBe(30)
  })

  it('X from now', () => {
    const result = evalLine('5 days from now')
    expect(result.type).toBe('date')
  })

  it('X ago', () => {
    const result = evalLine('3 days ago')
    expect(result.type).toBe('date')
  })

  it('day of the week on date', () => {
    const result = evalLine('day of the week on January 24, 1984')
    expect(result.value).toBe('Tuesday')
  })

  it('weekday on date', () => {
    const result = evalLine('weekday on March 9, 2024')
    expect(result.value).toBe('Saturday')
  })

  it('week of year', () => {
    const result = evalLine('week of year')
    expect(result.numericValue).toBeGreaterThan(0)
    expect(result.numericValue).toBeLessThanOrEqual(53)
  })

  it('week number on date', () => {
    const result = evalLine('week number on March 12, 2021')
    expect(result.numericValue).toBeGreaterThan(0)
  })

  it('days in February 2020 (leap)', () => {
    const result = evalLine('days in February 2020')
    expect(result.value).toBe('29 days')
  })

  it('days in February 2021 (non-leap)', () => {
    const result = evalLine('days in February 2021')
    expect(result.value).toBe('28 days')
  })

  it('days in Q1', () => {
    const result = evalLine('days in Q1')
    expect(result.numericValue).toBeGreaterThanOrEqual(90)
    expect(result.numericValue).toBeLessThanOrEqual(91)
  })

  it('days in Q2', () => {
    const result = evalLine('days in Q2')
    expect(result.value).toBe('91 days')
  })

  it('days in Q3', () => {
    const result = evalLine('days in Q3')
    expect(result.value).toBe('92 days')
  })

  it('days in Q4', () => {
    const result = evalLine('days in Q4')
    expect(result.value).toBe('92 days')
  })

  it('days between same date (0 days)', () => {
    const result = evalLine('days between March 1 and March 1')
    expect(result.value).toBe('0 days')
  })

  it('3 months from now', () => {
    const result = evalLine('3 months from now')
    expect(result.type).toBe('date')
  })

  it('2 years ago', () => {
    const result = evalLine('2 years ago')
    expect(result.type).toBe('date')
  })

  it('1 week from now', () => {
    const result = evalLine('1 week from now')
    expect(result.type).toBe('date')
  })

  it('3 weeks after March 14, 2019', () => {
    const result = evalLine('3 weeks after March 14, 2019')
    expect(result.type).toBe('date')
  })

  it('28 days before March 12', () => {
    const result = evalLine('28 days before March 12')
    expect(result.type).toBe('date')
  })

  it('current timestamp', () => {
    const result = evalLine('current timestamp')
    expect(result.numericValue).toBeGreaterThan(1000000000)
  })
})

describe('timespans and laptimes', () => {
  it('5.5 minutes as timespan', () => {
    const result = evalLine('5.5 minutes as timespan')
    expect(result.value).toBe('5 min 30 s')
  })

  it('4.54 hours as timespan', () => {
    const result = evalLine('4.54 hours as timespan')
    expect(result.value).toContain('4 hours')
    expect(result.value).toContain('min')
  })

  it('72 days as timespan', () => {
    const result = evalLine('72 days as timespan')
    expect(result.value).toContain('10 weeks')
    expect(result.value).toContain('2 days')
  })

  it('5.5 minutes as laptime', () => {
    const result = evalLine('5.5 minutes as laptime')
    expect(result.value).toBe('00:05:30')
  })

  it('3h 5m 10s in seconds', () => {
    const result = evalLine('3h 5m 10s in seconds')
    expect(result.type).toBe('unit')
  })

  it('03:04:05 + 01:02:03 as laptime', () => {
    const result = evalLine('03:04:05 + 01:02:03 as laptime')
    expect(result.value).toBe('04:06:08')
  })
})

describe('clock time intervals', () => {
  it('7:30 to 20:45', () => {
    const result = evalLine('7:30 to 20:45')
    expect(result.value).toBe('13 hours 15 min')
  })

  it('4pm to 3am', () => {
    const result = evalLine('4pm to 3am')
    expect(result.value).toBe('11 hours')
  })

  it('9am to 5pm', () => {
    const result = evalLine('9am to 5pm')
    expect(result.value).toBe('8 hours')
  })

  it('12am to 12pm', () => {
    const result = evalLine('12am to 12pm')
    expect(result.value).toBe('12 hours')
  })

  it('11pm to 1am (midnight crossing)', () => {
    const result = evalLine('11pm to 1am')
    expect(result.value).toBe('2 hours')
  })

  it('1.5 hours as timespan', () => {
    const result = evalLine('1.5 hours as timespan')
    expect(result.value).toBe('1 hour 30 min')
  })

  it('0 seconds as timespan', () => {
    const result = evalLine('0 seconds as timespan')
    expect(result.value).toBe('0 s')
  })
})

describe('timestamps and ISO 8601', () => {
  it('date to timestamp', () => {
    const result = evalLine('January 1, 2020 to timestamp')
    expect(result.numericValue).toBeGreaterThan(1500000000)
    expect(result.type).toBe('number')
  })

  it('date as iso8601', () => {
    const result = evalLine('June 15, 2020 as iso8601')
    expect(result.value).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('ISO string to date', () => {
    const result = evalLine('2019-04-01T15:30:00 to date')
    expect(result.type).toBe('date')
  })

  it('millisecond timestamp to date', () => {
    const result = evalLine('1733823083000 to date')
    expect(result.type).toBe('date')
  })
})

describe('workdays', () => {
  it('workdays in 3 weeks', () => {
    const result = evalLine('workdays in 3 weeks')
    expect(result.value).toBe('15 workdays')
    expect(result.numericValue).toBe(15)
  })

  it('workdays from date to date', () => {
    const result = evalLine('workdays from March 3 to March 7')
    expect(result.numericValue).toBeGreaterThan(0)
    expect(result.value).toContain('workday')
  })

  it('date to date in workdays', () => {
    const result = evalLine('March 3 to March 7 in workdays')
    expect(result.numericValue).toBeGreaterThan(0)
    expect(result.value).toContain('workday')
  })

  it('N workdays after date', () => {
    const result = evalLine('2 workdays after March 3, 2025')
    expect(result.type).toBe('date')
  })
})

describe('video timecode', () => {
  it('30 fps * 3 minutes', () => {
    const result = evalLine('30 fps * 3 minutes')
    expect(result.type).toBe('unit')
  })

  it('timecode to frames: 00:30:10:00 @ 24 fps', () => {
    const result = evalLine('00:30:10:00 @ 24 fps in frames')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('43,440')
  })

  it('timecode arithmetic: add 50 frames', () => {
    const result = evalLine('03:10:20:05 at 30 fps + 50 frames')
    expect(result.type).toBe('unit')
  })

  it('default 24 fps for timecode', () => {
    const result = evalLine('00:00:01:00 in frames')
    expect(result.value).toContain('24')
  })
})

describe('finance calculations', () => {
  it('compound interest yearly', () => {
    const result = evalLine('$1,000 after 3 years at 7%')
    expect(result.value).toBe('$1,225.04')
  })

  it('compound interest monthly', () => {
    const result = evalLine('$1,000 for 3 years at 7% compounding monthly')
    expect(result.value).toBe('$1,232.93')
  })

  it('compound interest quarterly', () => {
    const result = evalLine('$1,000 for 3 years at 7% compounding quarterly')
    expect(result.value).toBe('$1,231.44')
  })

  it('interest on (interest only)', () => {
    const result = evalLine('interest on $1,000 after 3 years @ 7%')
    expect(result.value).toBe('$225.04')
  })

  it('simple ROI', () => {
    const result = evalLine('$500 invested $1,500 returned')
    expect(result.value).toBe('3x')
  })

  it('annual return', () => {
    const result = evalLine(
      'annual return on $1,000 invested $2,500 returned after 7 years',
    )
    expect(result.value).toBe('13.99%')
  })

  it('present value', () => {
    const result = evalLine('present value of $1,000 after 20 years at 10%')
    expect(result.value).toBe('$148.64')
  })

  it('monthly repayment', () => {
    const result = evalLine('monthly repayment on $10,000 over 6 years at 6%')
    expect(result.value).toBe('$165.73')
  })

  it('total repayment', () => {
    const result = evalLine('total repayment on $10,000 over 6 years at 6%')
    expect(result.value).toBe('$11,932.48')
  })

  it('total interest', () => {
    const result = evalLine('total interest on $10,000 over 6 years at 6%')
    expect(result.value).toBe('$1,932.48')
  })
})

describe('misc functions', () => {
  it('larger of 100 and 200', () =>
    expectValue('larger of 100 and 200', '200'))
  it('greater of 100 and 200', () =>
    expectValue('greater of 100 and 200', '200'))
  it('smaller of 5 and 10', () => expectValue('smaller of 5 and 10', '5'))
  it('lesser of 5 and 10', () => expectValue('lesser of 5 and 10', '5'))

  it('half of 175', () => expectNumericClose('half of 175', 87.5))
  it('midpoint between 150 and 300', () =>
    expectValue('midpoint between 150 and 300', '225'))

  it('random number between 1 and 10', () => {
    const result = evalLine('random number between 1 and 10')
    const num = Number.parseFloat(result.value!.replace(/,/g, ''))
    expect(num).toBeGreaterThanOrEqual(1)
    expect(num).toBeLessThanOrEqual(10)
  })

  it('random number between 0 and 1', () => {
    const result = evalLine('random number between 0 and 1')
    const num = Number.parseFloat(result.value!.replace(/,/g, ''))
    expect(num).toBeGreaterThanOrEqual(0)
    expect(num).toBeLessThanOrEqual(1)
  })

  it('gcd of 20 and 30', () => expectValue('gcd of 20 and 30', '10'))
  it('lcm of 5 and 8', () => expectValue('lcm of 5 and 8', '40'))

  it('10 permutation 3', () => expectValue('10 permutation 3', '720'))
  it('25 combination 3', () => expectValue('25 combination 3', '2,300'))
  it('3 permutations of 10', () => expectValue('3 permutations of 10', '720'))
  it('3 combinations of 25', () =>
    expectValue('3 combinations of 25', '2,300'))

  it('clamp 26 between 5 and 25', () =>
    expectValue('clamp 26 between 5 and 25', '25'))
  it('clamp 4 from 5 to 25', () => expectValue('clamp 4 from 5 to 25', '5'))
  it('clamp 15 between 5 and 25', () =>
    expectValue('clamp 15 between 5 and 25', '15'))

  it('6 is to 60 as 8 is to what', () =>
    expectValue('6 is to 60 as 8 is to what', '80'))
  it('5 is to 10 as what is to 80', () =>
    expectValue('5 is to 10 as what is to 80', '40'))
})

describe('large number symbols', () => {
  it('7B (billion)', () => {
    const result = evalLine('7B')
    const num = Number.parseFloat(result.value!.replace(/,/g, ''))
    expect(num).toBe(7000000000)
  })

  it('5bn (billion)', () => {
    const result = evalLine('5bn')
    const num = Number.parseFloat(result.value!.replace(/,/g, ''))
    expect(num).toBe(5000000000)
  })

  it('2T (trillion)', () => {
    const result = evalLine('2T')
    const num = Number.parseFloat(result.value!.replace(/,/g, ''))
    expect(num).toBe(2000000000000)
  })

  it('10 trillion', () => {
    const result = evalLine('10 trillion')
    const num = Number.parseFloat(result.value!.replace(/,/g, ''))
    expect(num).toBe(10000000000000)
  })
})

describe('comments extensions', () => {
  it('parenthesis comment', () => {
    const result = evalLine('$999 (for iPhone 16)')
    expect(result.type).toBe('unit')
    expect(result.value).toContain('999')
  })

  it('end-of-line // comment', () => {
    expectValue('$128 + $45 // on 10-02-2019', '173 USD')
  })

  it('parenthesis with just numbers is NOT stripped', () => {
    expectValue('6(3)', '18')
  })
})

describe('error handling', () => {
  it('invalid expression returns error', () => {
    const result = evalLine('hello world')
    expect(result.error).not.toBeNull()
    expect(result.type).toBe('empty')
  })

  it('division by zero', () => {
    const result = evalLine('1 / 0')
    expect(result.value).not.toBeNull()
  })

  it('undefined variable', () => {
    const result = evalLine('unknownVar + 1')
    expect(result.error).not.toBeNull()
  })
})

describe('full document integration', () => {
  it('full document', () => {
    const doc = [
      '8 times 9',
      '$2k',
      'Price: $11 + $34.45',
      'v = 20',
      'v times 7',
      '100 + 15%',
      '5% on 200',
      '5% off 200',
      '50 as a % of 100',
      '5% of what is 6',
      '// This is comment',
      '# Header',
      '',
      '10 + 5',
      '20 * 3',
      'sum',
      'prev - 10',
      '0xFF in hex',
      '5300 in sci',
      'sqrt(16)',
    ].join('\n')

    const results = evalLines(doc)

    expect(results[0].value).toBe('72')
    expect(results[1].type).toBe('unit')
    expect(results[2].type).toBe('unit')
    expect(results[3].type).toBe('assignment')
    expect(results[3].value).toBe('20')
    expect(results[4].value).toBe('140')
    expectCloseInResults(results[5], 115)
    expectCloseInResults(results[6], 210)
    expectCloseInResults(results[7], 190)
    expectCloseInResults(results[8], 50)
    expectCloseInResults(results[9], 120)
    expect(results[10].type).toBe('comment')
    expect(results[10].value).toBeNull()
    expect(results[11].type).toBe('comment')
    expect(results[11].value).toBeNull()
    expect(results[12].type).toBe('empty')
    expect(results[13].value).toBe('15')
    expect(results[14].value).toBe('60')
    expect(results[15].value).toBe('75')
    expect(results[16].value).toBe('65')
    expect(results[17].value).toBe('0xFF')
    expect(results[18].value).toBe('5.3e+3')
    expect(results[19].value).toBe('4')
  })
})

function expectCloseInResults(
  result: ReturnType<typeof evalLine>,
  expected: number,
) {
  const num = Number.parseFloat(result.value!.replace(/,/g, ''))
  expect(num).toBeCloseTo(expected, 1)
}
