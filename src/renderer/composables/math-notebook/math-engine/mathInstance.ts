import { all, create } from 'mathjs'

import { DEFAULT_CURRENCY_RATES } from './constants'

function createUnitSafe(
  mathInstance: ReturnType<typeof create>,
  name: string,
  options: { definition?: string, aliases: string[] },
) {
  try {
    mathInstance.createUnit(name, options)
  }
  catch {
    // Ignore duplicate or unsupported unit definitions and keep the rest of the registry intact.
  }
}

export function createMathInstance(currencyRates: Record<string, number>) {
  const mathInstance = create(all, {
    number: 'number',
    precision: 14,
  })

  mathInstance.import(
    {
      fromunix: (ts: number) => new Date(ts * 1000),
      ln: (x: number) => Math.log(x),
      fact: (x: number) => mathInstance.factorial(x),
      root: (degree: number, value: number) =>
        mathInstance.nthRoot(value, degree),
      arcsin: (x: number) => mathInstance.asin(x),
      arccos: (x: number) => mathInstance.acos(x),
      arctan: (x: number) => mathInstance.atan(x),
      unitValue: (value: any) =>
        value && typeof value.toNumber === 'function'
          ? value.toNumber()
          : Number(value),
    },
    { override: true },
  )

  createUnitSafe(mathInstance, 'USD', { aliases: ['usd'] })
  createUnitSafe(mathInstance, 'numisecond', {
    definition: '1 second',
    aliases: [],
  })
  createUnitSafe(mathInstance, 'numiminute', {
    definition: '60 numisecond',
    aliases: [],
  })
  createUnitSafe(mathInstance, 'numihour', {
    definition: '60 numiminute',
    aliases: [],
  })
  createUnitSafe(mathInstance, 'numiday', {
    definition: '24 numihour',
    aliases: [],
  })
  createUnitSafe(mathInstance, 'numiweek', {
    definition: '7 numiday',
    aliases: [],
  })
  createUnitSafe(mathInstance, 'numiyear', {
    definition: '365 numiday',
    aliases: [],
  })
  createUnitSafe(mathInstance, 'numimonth', {
    definition: `${365 / 12} numiday`,
    aliases: [],
  })
  createUnitSafe(mathInstance, 'are', {
    definition: '100 m^2',
    aliases: ['ares'],
  })
  createUnitSafe(mathInstance, 'carat', {
    definition: '0.2 gram',
    aliases: ['carats'],
  })
  createUnitSafe(mathInstance, 'pound', {
    definition: '1 lb',
    aliases: ['pounds'],
  })
  createUnitSafe(mathInstance, 'centner', {
    definition: '100 kg',
    aliases: ['centners'],
  })
  createUnitSafe(mathInstance, 'point', {
    definition: '0.0138888888889 inch',
    aliases: ['points'],
  })
  createUnitSafe(mathInstance, 'line', {
    definition: '0.0833333333333 inch',
    aliases: ['lines'],
  })
  createUnitSafe(mathInstance, 'hand', {
    definition: '4 inch',
    aliases: ['hands'],
  })
  createUnitSafe(mathInstance, 'furlong', {
    definition: '660 ft',
    aliases: ['furlongs'],
  })
  createUnitSafe(mathInstance, 'cable', {
    definition: '185.2 m',
    aliases: ['cables'],
  })
  createUnitSafe(mathInstance, 'nauticalmile', {
    definition: '1852 m',
    aliases: ['nauticalmiles'],
  })
  createUnitSafe(mathInstance, 'league', {
    definition: '3 mile',
    aliases: ['leagues'],
  })

  for (const [code, rate] of Object.entries(currencyRates)) {
    if (code === 'USD')
      continue

    createUnitSafe(mathInstance, code, {
      definition: `${1 / rate} USD`,
      aliases: [code.toLowerCase()],
    })
  }

  return mathInstance
}

export function createDefaultMathInstance() {
  return createMathInstance(DEFAULT_CURRENCY_RATES)
}
