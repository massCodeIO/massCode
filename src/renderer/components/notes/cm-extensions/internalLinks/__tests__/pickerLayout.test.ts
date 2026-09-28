import { describe, expect, it } from 'vitest'
import { getInternalLinksPickerLayout } from '../pickerLayout'

describe('getInternalLinksPickerLayout', () => {
  it('opens downward when there is enough space below the cursor', () => {
    expect(
      getInternalLinksPickerLayout({
        anchor: { left: 200, top: 120 },
        viewport: { height: 900, width: 1200 },
      }),
    ).toEqual({
      left: 200,
      maxHeight: 280,
      side: 'bottom',
    })
  })

  it('opens upward when there is not enough space below and more room above', () => {
    expect(
      getInternalLinksPickerLayout({
        anchor: { left: 200, top: 720 },
        viewport: { height: 800, width: 1200 },
      }),
    ).toEqual({
      left: 200,
      maxHeight: 280,
      side: 'top',
    })
  })

  it('shrinks results height and clamps horizontally near viewport edges', () => {
    expect(
      getInternalLinksPickerLayout({
        anchor: { left: 600, top: 130 },
        viewport: { height: 260, width: 640 },
      }),
    ).toEqual({
      left: 308,
      maxHeight: 110,
      side: 'bottom',
    })
  })
})
