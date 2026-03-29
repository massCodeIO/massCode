import { beforeEach, describe, expect, it } from 'vitest'
import {
  evalLine,
  evalLines,
  expectNumericClose,
  setFormatSettings,
  setupCurrencyRates,
} from './mathEngineTestUtils'

beforeEach(() => {
  setupCurrencyRates()
  setFormatSettings('en-US', 6, 'numeric')
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

function expectCloseInResults(
  result: ReturnType<typeof evalLine>,
  expected: number,
) {
  const num = Number.parseFloat(result.value!.replace(/,/g, ''))
  expect(num).toBeCloseTo(expected, 1)
}
