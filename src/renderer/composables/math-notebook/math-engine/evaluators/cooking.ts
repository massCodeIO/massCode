import type { LineResult } from '../types'

interface CookingResult {
  lineResult: LineResult
  rawResult: number
}

// Densities in g/cm³ (g/mL). Source: USDA, common cooking references.
const DENSITIES: Record<string, number> = {
  'water': 1.0,
  'milk': 1.03,
  'whole milk': 1.03,
  'skim milk': 1.035,
  'buttermilk': 1.03,
  'cream': 0.994,
  'heavy cream': 0.994,
  'whipping cream': 0.994,
  'sour cream': 1.05,
  'yogurt': 1.06,
  'greek yogurt': 1.1,
  'butter': 0.911,
  'melted butter': 0.911,
  'coconut oil': 0.925,
  'olive oil': 0.916,
  'vegetable oil': 0.92,
  'canola oil': 0.915,
  'sesame oil': 0.92,
  'oil': 0.92,
  'honey': 1.42,
  'maple syrup': 1.32,
  'corn syrup': 1.38,
  'molasses': 1.42,
  'sugar': 0.845,
  'white sugar': 0.845,
  'brown sugar': 0.93,
  'powdered sugar': 0.56,
  'icing sugar': 0.56,
  'confectioners sugar': 0.56,
  'salt': 1.217,
  'table salt': 1.217,
  'kosher salt': 0.69,
  'sea salt': 1.1,
  'flour': 0.593,
  'all purpose flour': 0.529,
  'bread flour': 0.55,
  'cake flour': 0.48,
  'whole wheat flour': 0.512,
  'almond flour': 0.4,
  'coconut flour': 0.48,
  'rice flour': 0.6,
  'cornstarch': 0.54,
  'baking powder': 0.9,
  'baking soda': 1.1,
  'cocoa powder': 0.41,
  'cacao powder': 0.41,
  'nutella': 1.2,
  'peanut butter': 1.09,
  'almond butter': 1.06,
  'jam': 1.33,
  'jelly': 1.3,
  'ketchup': 1.15,
  'mayonnaise': 0.91,
  'mustard': 1.05,
  'soy sauce': 1.17,
  'vinegar': 1.006,
  'balsamic vinegar': 1.12,
  'apple cider vinegar': 1.01,
  'tomato sauce': 1.03,
  'tomato paste': 1.25,
  'white wine': 1.04,
  'red wine': 1.04,
  'wine': 1.04,
  'beer': 1.01,
  'rice wine': 1.03,
  'miso': 1.16,
  'soy milk': 1.03,
  'almond milk': 1.01,
  'oat milk': 1.03,
  'coconut milk': 0.97,
  'condensed milk': 1.33,
  'evaporated milk': 1.07,
  'whipped cream': 0.25,
  'cream cheese': 1.02,
  'ricotta cheese': 1.03,
  'cottage cheese': 1.02,
  'mascarpone': 1.04,
  'rice': 0.85,
  'white rice': 0.85,
  'brown rice': 0.8,
  'oats': 0.41,
  'rolled oats': 0.35,
  'quinoa': 0.77,
  'lentils': 0.8,
  'chickpeas': 0.76,
  'beans': 0.75,
  'black beans': 0.75,
  'corn': 0.72,
  'peas': 0.73,
  'raisins': 0.7,
  'chocolate chips': 0.68,
  'cocoa butter': 0.99,
  'shredded coconut': 0.34,
  'ground cinnamon': 0.56,
  'ground ginger': 0.5,
  'ground nutmeg': 0.53,
  'ground cloves': 0.55,
  'ground pepper': 0.5,
  'chili powder': 0.52,
  'curry powder': 0.5,
  'garlic powder': 0.66,
  'onion powder': 0.6,
  'paprika': 0.46,
  'turmeric': 0.72,
  'dried basil': 0.28,
  'dried oregano': 0.32,
  'dried thyme': 0.38,
  'dried rosemary': 0.3,
  'yeast': 0.82,
  'active dry yeast': 0.68,
  'gelatin': 0.63,
  'agar agar': 0.55,
  'bread crumbs': 0.45,
  'panko bread crumbs': 0.18,
  'graham cracker crumbs': 0.5,
  'sprinkles': 0.8,
  'vanilla extract': 0.88,
  'lemon juice': 1.03,
  'lime juice': 1.03,
  'orange juice': 1.04,
  'apple juice': 1.04,
  'cranberry juice': 1.05,
  'grape juice': 1.07,
  'pineapple juice': 1.05,
  'applesauce': 1.07,
  'pumpkin puree': 1.06,
}

// 1 US cup = 236.588 mL
const ML_PER_CUP = 236.588
const ML_PER_TBSP = 14.787
const ML_PER_TSP = 4.929
const ML_PER_FLOZ = 29.574
const ML_PER_PINT = 473.176
const ML_PER_QUART = 946.353
const ML_PER_GALLON = 3785.41
const ML_PER_LITER = 1000

const VOLUME_UNITS: Record<string, number> = {
  'cup': ML_PER_CUP,
  'cups': ML_PER_CUP,
  'tablespoon': ML_PER_TBSP,
  'tablespoons': ML_PER_TBSP,
  'tbsp': ML_PER_TBSP,
  'teaspoon': ML_PER_TSP,
  'teaspoons': ML_PER_TSP,
  'tsp': ML_PER_TSP,
  'fl oz': ML_PER_FLOZ,
  'floz': ML_PER_FLOZ,
  'pint': ML_PER_PINT,
  'pints': ML_PER_PINT,
  'quart': ML_PER_QUART,
  'quarts': ML_PER_QUART,
  'gallon': ML_PER_GALLON,
  'gallons': ML_PER_GALLON,
  'liter': ML_PER_LITER,
  'liters': ML_PER_LITER,
  'litre': ML_PER_LITER,
  'litres': ML_PER_LITER,
  'ml': 1,
  'milliliter': 1,
  'milliliters': 1,
}

const MASS_UNITS: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,
  oz: 28.3495,
  ounce: 28.3495,
  ounces: 28.3495,
  lb: 453.592,
  pound: 453.592,
  pounds: 453.592,
}

function findSubstance(text: string): { name: string, density: number } | null {
  const lower = text.toLowerCase().trim()
  // Try exact match first, then partial
  if (DENSITIES[lower]) {
    return { name: lower, density: DENSITIES[lower] }
  }
  // Try matching substance name within the text
  for (const [name, density] of Object.entries(DENSITIES)) {
    if (lower.includes(name)) {
      return { name, density }
    }
  }
  return null
}

function formatResult(
  value: number,
  unit: string,
  decimals = 2,
): CookingResult {
  const formatted = value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return {
    lineResult: {
      value: `${formatted} ${unit}`,
      error: null,
      type: 'number',
      numericValue: value,
    },
    rawResult: value,
  }
}

export function evaluateCookingLine(line: string): CookingResult | null {
  const lower = line.toLowerCase().trim()

  // "density of X"
  if (lower.startsWith('density of ')) {
    const substance = findSubstance(lower.slice(11))
    if (substance) {
      return {
        lineResult: {
          value: `${substance.density} g/cm³`,
          error: null,
          type: 'number',
          numericValue: substance.density,
        },
        rawResult: substance.density,
      }
    }
  }

  // Parse: "NUMBER UNIT SUBSTANCE in TARGET_UNIT"
  const inIdx = lower.lastIndexOf(' in ')
  if (inIdx <= 0)
    return null

  const targetUnit = lower.slice(inIdx + 4).trim()
  const before = lower.slice(0, inIdx).trim()

  // Extract leading number
  const numMatch = before.match(/^(\d+(?:\.\d+)?)\s*/)
  if (!numMatch)
    return null

  const amount = Number(numMatch[1])
  const rest = before.slice(numMatch[0].length)

  // Try mass → volume: "300g butter in cups"
  const massUnitMatch = rest.match(
    /^(g|gram|grams|kg|kilogram|kilograms|oz|ounce|ounces|lb|pound|pounds)\s+/,
  )
  if (massUnitMatch) {
    const massUnit = MASS_UNITS[massUnitMatch[1]]
    const substanceName = rest.slice(massUnitMatch[0].length)
    const substance = findSubstance(substanceName)
    const volumeUnit = VOLUME_UNITS[targetUnit]

    if (massUnit && substance && volumeUnit) {
      const volumeInMl = (amount * massUnit) / substance.density
      return formatResult(volumeInMl / volumeUnit, targetUnit)
    }
  }

  // Try volume → mass: "10 cups olive oil in grams"
  const volUnitMatch = rest.match(
    /^(cups?|tablespoons?|tbsp|teaspoons?|tsp|pints?|quarts?|gallons?|liters?|litres?|ml|milliliters?)\s+/,
  )
  if (volUnitMatch) {
    const volumeUnit = VOLUME_UNITS[volUnitMatch[1]]
    const substanceName = rest.slice(volUnitMatch[0].length)
    const substance = findSubstance(substanceName)
    const massUnit = MASS_UNITS[targetUnit]

    if (volumeUnit && substance && massUnit) {
      const massInGrams = amount * volumeUnit * substance.density
      return formatResult(massInGrams / massUnit, targetUnit, 0)
    }
  }

  return null
}
