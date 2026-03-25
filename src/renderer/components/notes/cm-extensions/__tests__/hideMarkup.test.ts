import { describe, expect, it } from 'vitest'
import { canShowMarkup, shouldHideUrlNodeInMarkup } from '../hideMarkup'

describe('hideMarkup url visibility', () => {
  it('hides URL node inside markdown link', () => {
    expect(shouldHideUrlNodeInMarkup('URL', 'Link')).toBe(true)
  })

  it('hides URL node inside markdown image', () => {
    expect(shouldHideUrlNodeInMarkup('URL', 'Image')).toBe(true)
  })

  it('does not hide plain URL node outside markdown link/image', () => {
    expect(shouldHideUrlNodeInMarkup('URL', 'Paragraph')).toBe(false)
    expect(shouldHideUrlNodeInMarkup('URL', null)).toBe(false)
  })

  it('does not affect non-url nodes', () => {
    expect(shouldHideUrlNodeInMarkup('LinkMark', 'Link')).toBe(false)
  })
})

describe('canShowMarkup', () => {
  it('returns false when editor is blurred', () => {
    expect(canShowMarkup(false, false)).toBe(false)
  })

  it('returns false when alwaysHide is enabled', () => {
    expect(canShowMarkup(true, true)).toBe(false)
    expect(canShowMarkup(true, false)).toBe(false)
  })

  it('returns true only when editor is focused and alwaysHide is off', () => {
    expect(canShowMarkup(false, true)).toBe(true)
  })
})
