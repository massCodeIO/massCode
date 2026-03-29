export function evaluateBlockAggregate(
  keyword: string,
  numericBlock: number[],
): { value: number } | null {
  switch (keyword) {
    case 'sum':
    case 'total':
      return { value: numericBlock.reduce((sum, v) => sum + v, 0) }

    case 'average':
    case 'avg':
      return {
        value:
          numericBlock.length > 0
            ? numericBlock.reduce((sum, v) => sum + v, 0) / numericBlock.length
            : 0,
      }

    case 'median':
      if (numericBlock.length === 0)
        return { value: 0 }
      {
        const sorted = [...numericBlock].sort((a, b) => a - b)
        const mid = Math.floor(sorted.length / 2)
        return {
          value:
            sorted.length % 2 !== 0
              ? sorted[mid]
              : (sorted[mid - 1] + sorted[mid]) / 2,
        }
      }

    case 'count':
      return { value: numericBlock.length }

    default:
      return null
  }
}

export function evaluateInlineAggregate(
  line: string,
): { value: number } | null {
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

  switch (fn) {
    case 'total':
    case 'sum':
      return { value: items.reduce((a, b) => a + b, 0) }
    case 'average':
    case 'avg':
      return { value: items.reduce((a, b) => a + b, 0) / items.length }
    case 'median': {
      const sorted = [...items].sort((a, b) => a - b)
      const mid = Math.floor(sorted.length / 2)
      return {
        value:
          sorted.length % 2 !== 0
            ? sorted[mid]
            : (sorted[mid - 1] + sorted[mid]) / 2,
      }
    }
    case 'count':
      return { value: items.length }
    default:
      return null
  }
}
