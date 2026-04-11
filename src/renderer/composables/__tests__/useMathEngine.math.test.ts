/* eslint-disable test/prefer-lowercase-title */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  evalLine,
  evalLines,
  expectNumericClose,
  expectValue,
  setFormatSettings,
  setupCurrencyRates,
} from './mathEngineTestUtils'

beforeEach(() => {
  setupCurrencyRates()
  setFormatSettings('en-US', 6, 'numeric')
})

describe('arithmetic', () => {
  it('addition', () => expectValue('10 + 5', '15'))
  it('subtraction', () => expectValue('20 - 3', '17'))
  it('multiplication', () => expectValue('4 * 5', '20'))
  it('division', () => expectValue('100 / 4', '25'))
  it('prefers division over ambiguous slash dates', () => {
    expectNumericClose('4/3', 4 / 3, 4)
    expectNumericClose('22/11', 2, 4)
  })
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

describe('locale-aware full slash dates', () => {
  it('uses mdy parsing for en-US', () => {
    setFormatSettings('en-US', 6, 'numeric')

    const result = evalLine('11/22/2005')
    expect(result.type).toBe('date')
    expect(result.value).toContain(
      new Date(2005, 10, 22).toLocaleDateString('en-US'),
    )

    expectNumericClose('22/11/2005', 22 / 11 / 2005, 6)
  })

  it('uses dmy parsing for en-GB', () => {
    setFormatSettings('en-GB', 6, 'numeric')

    const result = evalLine('22/11/2005')
    expect(result.type).toBe('date')
    expect(result.value).toContain(
      new Date(2005, 10, 22).toLocaleDateString('en-GB'),
    )

    expectNumericClose('11/22/2005', 11 / 22 / 2005, 6)
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

describe('constants', () => {
  it('pi', () => expectNumericClose('pi', 3.14159, 4))
  it('e', () => expectNumericClose('e', 2.71828, 4))
  it('tau', () => expectNumericClose('tau', 6.28318, 4))
  it('phi', () => expectNumericClose('phi', 1.61803, 4))
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

  it('sets numericValue for unit result', () => {
    const result = evalLine('10 USD')
    expect(result.numericValue).toBe(10)
  })

  it('sets numericValue for unit assignment', () => {
    const results = evalLines('price = 10 USD')
    expect(results[0].numericValue).toBe(10)
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

describe('strict time semantics', () => {
  it('1 month in days', () =>
    expectNumericClose('1 month in days', 365 / 12, 3))
  it('1 year in days', () => expectNumericClose('1 year in days', 365, 3))
  it('2 hours + 30 minutes', () =>
    expectNumericClose('2 hours + 30 minutes', 2.5, 2))
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
