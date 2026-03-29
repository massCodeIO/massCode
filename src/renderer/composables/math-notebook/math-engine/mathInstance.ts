import { all, create } from 'mathjs'

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
      sind: (x: number) => Math.sin((x * Math.PI) / 180),
      cosd: (x: number) => Math.cos((x * Math.PI) / 180),
      tand: (x: number) => Math.tan((x * Math.PI) / 180),
      asind: (x: number) => (Math.asin(x) * 180) / Math.PI,
      acosd: (x: number) => (Math.acos(x) * 180) / Math.PI,
      atand: (x: number) => (Math.atan(x) * 180) / Math.PI,
      unitValue: (value: any) =>
        value && typeof value.toNumber === 'function'
          ? value.toNumber()
          : Number(value),
    },
    { override: true },
  )

  createUnitSafe(mathInstance, 'USD', { aliases: ['usd'] })
  createUnitSafe(mathInstance, 'mcsecond', {
    definition: '1 second',
    aliases: [],
  })
  createUnitSafe(mathInstance, 'mcminute', {
    definition: '60 mcsecond',
    aliases: [],
  })
  createUnitSafe(mathInstance, 'mchour', {
    definition: '60 mcminute',
    aliases: [],
  })
  createUnitSafe(mathInstance, 'mcday', {
    definition: '24 mchour',
    aliases: [],
  })
  createUnitSafe(mathInstance, 'mcweek', {
    definition: '7 mcday',
    aliases: [],
  })
  createUnitSafe(mathInstance, 'mcyear', {
    definition: '365 mcday',
    aliases: [],
  })
  createUnitSafe(mathInstance, 'mcmonth', {
    definition: `${365 / 12} mcday`,
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

  // Speed
  createUnitSafe(mathInstance, 'mph', {
    definition: '1 mile/hour',
    aliases: [],
  })
  createUnitSafe(mathInstance, 'kmh', {
    definition: '1 km/hour',
    aliases: [],
  })
  createUnitSafe(mathInstance, 'knot', {
    definition: '0.514444 m/s',
    aliases: ['knots', 'kn'],
  })

  // Energy
  createUnitSafe(mathInstance, 'calorie', {
    definition: '4.184 J',
    aliases: ['cal', 'calories'],
  })
  createUnitSafe(mathInstance, 'kilocalorie', {
    definition: '4184 J',
    aliases: ['kcal', 'kCal', 'kilocalories'],
  })

  // Maritime & Astro
  createUnitSafe(mathInstance, 'fathom', {
    definition: '1.8288 m',
    aliases: ['fathoms', 'ftm'],
  })
  createUnitSafe(mathInstance, 'lightyear', {
    definition: '9.461e15 m',
    aliases: ['lightyears', 'ly'],
  })

  // Mass
  createUnitSafe(mathInstance, 'microgram', {
    definition: '1e-6 gram',
    aliases: ['micrograms', 'mcg'],
  })

  // Volume
  createUnitSafe(mathInstance, 'bushel', {
    definition: '35.2391 liter',
    aliases: ['bushels', 'bsh'],
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
