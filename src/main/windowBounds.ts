import type { Rectangle } from 'electron'

export const DEFAULT_WINDOW_BOUNDS: Pick<Rectangle, 'width' | 'height'> = {
  width: 1200,
  height: 800,
}

interface WindowBoundsDisplay {
  workArea: Rectangle
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.round(value)
    : undefined
}

function readDimension(value: unknown) {
  const number = readNumber(value)

  return number && number > 0 ? number : undefined
}

function hasVisibleIntersection(bounds: Rectangle, workArea: Rectangle) {
  const overlapWidth
    = Math.min(bounds.x + bounds.width, workArea.x + workArea.width)
      - Math.max(bounds.x, workArea.x)
  const overlapHeight
    = Math.min(bounds.y + bounds.height, workArea.y + workArea.height)
      - Math.max(bounds.y, workArea.y)

  return (
    overlapWidth >= Math.min(80, bounds.width)
    && overlapHeight >= Math.min(80, bounds.height)
  )
}

export function normalizeWindowBounds(
  value: unknown,
  displays: WindowBoundsDisplay[],
): Partial<Rectangle> {
  if (!isRecord(value)) {
    return {}
  }

  const width = readDimension(value.width)
  const height = readDimension(value.height)
  const x = readNumber(value.x)
  const y = readNumber(value.y)
  const bounds: Partial<Rectangle> = {}

  if (width) {
    bounds.width = width
  }

  if (height) {
    bounds.height = height
  }

  if (x === undefined || y === undefined) {
    return bounds
  }

  const positionedBounds: Rectangle = {
    x,
    y,
    width: width ?? DEFAULT_WINDOW_BOUNDS.width,
    height: height ?? DEFAULT_WINDOW_BOUNDS.height,
  }

  if (
    displays.some(display =>
      hasVisibleIntersection(positionedBounds, display.workArea),
    )
  ) {
    bounds.x = x
    bounds.y = y
  }

  return bounds
}
