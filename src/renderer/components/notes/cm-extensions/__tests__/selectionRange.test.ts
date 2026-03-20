import { describe, expect, it } from 'vitest'
import { isSelectionInsideRangeWithFocus } from '../selectionRange'

describe('isSelectionInsideRangeWithFocus', () => {
  it('treats start boundary cursor position as inside block when focused', () => {
    expect(isSelectionInsideRangeWithFocus(true, 10, 10, 10, 30, true)).toBe(
      true,
    )
    expect(isSelectionInsideRangeWithFocus(true, 30, 30, 10, 30, true)).toBe(
      true,
    )
  })

  it('treats cursor inside block body as inside', () => {
    expect(isSelectionInsideRangeWithFocus(true, 11, 11, 10, 30, true)).toBe(
      true,
    )
    expect(isSelectionInsideRangeWithFocus(true, 29, 29, 10, 30, true)).toBe(
      true,
    )
  })

  it('treats ranged selection with overlap as inside', () => {
    expect(isSelectionInsideRangeWithFocus(true, 5, 15, 10, 30, false)).toBe(
      true,
    )
    expect(isSelectionInsideRangeWithFocus(true, 20, 40, 10, 30, false)).toBe(
      true,
    )
  })

  it('treats ranged selection touching only boundary as outside', () => {
    expect(isSelectionInsideRangeWithFocus(true, 0, 10, 10, 30, false)).toBe(
      false,
    )
    expect(isSelectionInsideRangeWithFocus(true, 30, 40, 10, 30, false)).toBe(
      false,
    )
  })

  it('always returns false when editor is not focused', () => {
    expect(isSelectionInsideRangeWithFocus(false, 10, 10, 10, 30, true)).toBe(
      false,
    )
    expect(isSelectionInsideRangeWithFocus(false, 12, 18, 10, 30, false)).toBe(
      false,
    )
  })
})
