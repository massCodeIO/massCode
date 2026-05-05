import type { Rectangle } from 'electron'
import { describe, expect, it } from 'vitest'
import { DEFAULT_WINDOW_BOUNDS, normalizeWindowBounds } from '../windowBounds'

function display(workArea: Rectangle) {
  return { workArea }
}

describe('normalizeWindowBounds', () => {
  const displays = [
    display({ x: 0, y: 0, width: 1440, height: 900 }),
    display({ x: 1440, y: 0, width: 1920, height: 1080 }),
  ]

  it('keeps bounds on an external display', () => {
    expect(
      normalizeWindowBounds(
        { x: 1600, y: 120, width: 1200, height: 800 },
        displays,
      ),
    ).toEqual({ x: 1600, y: 120, width: 1200, height: 800 })
  })

  it('keeps bounds on an external display with negative coordinates', () => {
    expect(
      normalizeWindowBounds({ x: -1500, y: 80, width: 1200, height: 800 }, [
        display({ x: -1920, y: 0, width: 1920, height: 1080 }),
        display({ x: 0, y: 0, width: 1440, height: 900 }),
      ]),
    ).toEqual({ x: -1500, y: 80, width: 1200, height: 800 })
  })

  it('drops position when the saved display is unavailable', () => {
    expect(
      normalizeWindowBounds({ x: 2600, y: 100, width: 1200, height: 800 }, [
        display({ x: 0, y: 0, width: 1440, height: 900 }),
      ]),
    ).toEqual({ width: 1200, height: 800 })
  })

  it('uses the default size when checking a saved position without size', () => {
    expect(normalizeWindowBounds({ x: 1500, y: 40 }, displays)).toEqual({
      x: 1500,
      y: 40,
    })

    expect(DEFAULT_WINDOW_BOUNDS).toEqual({ width: 1200, height: 800 })
  })

  it('ignores invalid stored values', () => {
    expect(
      normalizeWindowBounds(
        { x: Number.NaN, y: 20, width: -1, height: '800' },
        displays,
      ),
    ).toEqual({})
  })
})
