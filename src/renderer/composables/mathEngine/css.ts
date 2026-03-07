import type { CssContext, SpecialLineResult } from './types'
import { lengthInchesByUnit } from './constants'
import { splitByKeyword } from './preprocess'

function normalizeCssUnit(unit: string) {
  const normalized = unit.toLowerCase()

  if (normalized === 'pixel' || normalized === 'pixels')
    return 'px'
  if (normalized === 'point' || normalized === 'points')
    return 'pt'
  if (normalized in lengthInchesByUnit)
    return normalized
  if (normalized === 'px' || normalized === 'pt' || normalized === 'em')
    return normalized

  return null
}

function parseCssQuantity(text: string) {
  const match = text.trim().match(/^(-?\d+(?:\.\d+)?)\s*([a-z]+)$/i)
  if (!match)
    return null

  const value = Number(match[1])
  const unit = normalizeCssUnit(match[2])

  if (Number.isNaN(value) || !unit)
    return null

  return { value, unit }
}

function toPx(
  quantity: { value: number, unit: string },
  cssContext: CssContext,
) {
  switch (quantity.unit) {
    case 'px':
      return quantity.value
    case 'pt':
      return (quantity.value * cssContext.ppi) / 72
    case 'em':
      return quantity.value * cssContext.emPx
    default:
      return (
        quantity.value * lengthInchesByUnit[quantity.unit] * cssContext.ppi
      )
  }
}

function fromPx(pxValue: number, targetUnit: string, cssContext: CssContext) {
  switch (targetUnit) {
    case 'px':
      return pxValue
    case 'pt':
      return (pxValue * 72) / cssContext.ppi
    case 'em':
      return pxValue / cssContext.emPx
    default:
      return pxValue / cssContext.ppi / lengthInchesByUnit[targetUnit]
  }
}

function formatNumberValue(value: number) {
  return Number.isInteger(value)
    ? value.toLocaleString('en-US')
    : value.toLocaleString('en-US', { maximumFractionDigits: 6 })
}

function formatUnitValue(value: number, unit: string) {
  return `${formatNumberValue(value)} ${unit}`
}

export function evaluateCssLine(
  line: string,
  cssContext: CssContext,
): SpecialLineResult | null {
  const ppiAssignmentMatch = line.match(/^ppi\s*=\s*(-?\d+(?:\.\d+)?)$/i)
  if (ppiAssignmentMatch) {
    const nextPpi = Number(ppiAssignmentMatch[1])
    if (Number.isNaN(nextPpi)) {
      return null
    }

    cssContext.ppi = nextPpi
    return {
      lineResult: {
        value: formatNumberValue(nextPpi),
        error: null,
        type: 'assignment',
      },
      rawResult: nextPpi,
    }
  }

  const emAssignmentMatch = line.match(/^em\s*=\s*(-?\d+(?:\.\d+)?)\s*px$/i)
  if (emAssignmentMatch) {
    const nextEm = Number(emAssignmentMatch[1])
    if (Number.isNaN(nextEm)) {
      return null
    }

    cssContext.emPx = nextEm
    return {
      lineResult: {
        value: formatUnitValue(nextEm, 'px'),
        error: null,
        type: 'assignment',
      },
      rawResult: nextEm,
    }
  }

  const conversionParts = splitByKeyword(line, [
    ' into ',
    ' in ',
    ' to ',
    ' as ',
  ])
  if (!conversionParts) {
    return null
  }

  const source = parseCssQuantity(conversionParts[0])
  const targetUnit = normalizeCssUnit(conversionParts[1])

  if (!source || !targetUnit) {
    return null
  }

  const sourceIsCss = ['px', 'pt', 'em'].includes(source.unit)
  const targetIsCss = ['px', 'pt', 'em'].includes(targetUnit)
  const sourceIsLength = source.unit in lengthInchesByUnit
  const targetIsLength = targetUnit in lengthInchesByUnit

  if (!sourceIsCss && !targetIsCss && (!sourceIsLength || !targetIsLength)) {
    return null
  }

  const pxValue = toPx(source, cssContext)
  const converted = fromPx(pxValue, targetUnit, cssContext)

  return {
    lineResult: {
      value: formatUnitValue(converted, targetUnit),
      error: null,
      type: 'unit',
    },
    rawResult: converted,
  }
}
