import fs from 'fs-extra'

function isFinitePositiveTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export function normalizeTimestamp(value: unknown, fallback: number): number {
  if (value instanceof Date) {
    const timestamp = value.getTime()
    if (Number.isFinite(timestamp)) {
      return timestamp
    }
  }

  const numericValue = Number(value)
  if (Number.isFinite(numericValue)) {
    return numericValue
  }

  if (typeof value === 'string') {
    const parsedDate = Date.parse(value)
    if (Number.isFinite(parsedDate)) {
      return parsedDate
    }
  }

  return fallback
}

export function getFileTimestampFallbacks(
  absolutePath: string,
  now: number,
): { createdAt: number, updatedAt: number } {
  try {
    const stats = fs.statSync(absolutePath)
    const updatedAt = isFinitePositiveTimestamp(stats.mtimeMs)
      ? stats.mtimeMs
      : now
    const createdAt = isFinitePositiveTimestamp(stats.birthtimeMs)
      ? stats.birthtimeMs
      : updatedAt

    return {
      createdAt,
      updatedAt,
    }
  }
  catch {
    return {
      createdAt: now,
      updatedAt: now,
    }
  }
}
