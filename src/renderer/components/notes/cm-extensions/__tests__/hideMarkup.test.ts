import { describe, expect, it } from 'vitest'
import { shouldHideUrlNodeInMarkup } from '../hideMarkup'

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
