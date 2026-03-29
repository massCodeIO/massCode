export interface BlockEntry {
  value: number
  unit?: string
}

export interface AggregateResult {
  value: number
  unit?: string
}

function getConsistentUnit(block: BlockEntry[]): string | undefined | null {
  if (block.length === 0)
    return undefined
  const units = new Set(block.map(e => e.unit))
  if (units.size === 1)
    return block[0].unit
  // Mixed units — cannot aggregate
  return null
}

function computeAggregate(keyword: string, values: number[]): number | null {
  if (values.length === 0)
    return keyword === 'count' ? 0 : 0

  switch (keyword) {
    case 'sum':
    case 'total':
      return values.reduce((sum, v) => sum + v, 0)
    case 'average':
    case 'avg':
      return values.reduce((sum, v) => sum + v, 0) / values.length
    case 'median': {
      const sorted = [...values].sort((a, b) => a - b)
      const mid = Math.floor(sorted.length / 2)
      return sorted.length % 2 !== 0
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2
    }
    case 'count':
      return values.length
    default:
      return null
  }
}

export function evaluateBlockAggregate(
  keyword: string,
  numericBlock: BlockEntry[],
): AggregateResult | null {
  const consistentUnit = getConsistentUnit(numericBlock)

  // null = mixed units, cannot sum/average (count still works)
  if (consistentUnit === null && keyword !== 'count') {
    return null
  }

  const values = numericBlock.map(e => e.value)
  const result = computeAggregate(keyword, values)
  if (result === null)
    return null

  return {
    value: result,
    unit: keyword === 'count' ? undefined : consistentUnit || undefined,
  }
}

export function evaluateInlineAggregate(line: string): AggregateResult | null {
  const match = line.match(/^(total|sum|average|avg|median|count)\s+of\s+/i)
  if (!match)
    return null

  const fn = match[1].toLowerCase()
  const listStr = line.slice(match[0].length)
  const items = listStr
    .replace(/\band\b/gi, ',')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter(n => !Number.isNaN(n))

  if (items.length === 0)
    return null

  const result = computeAggregate(fn, items)
  if (result === null)
    return null

  return { value: result }
}
