import { describe, expect, it } from 'vitest'
import {
  shouldRebuildMarkdownDecorations,
  shouldReplaceHorizontalRule,
} from '../markdownDecorations'

describe('shouldRebuildMarkdownDecorations', () => {
  it('rebuilds on focus change', () => {
    expect(
      shouldRebuildMarkdownDecorations({
        docChanged: false,
        selectionSet: false,
        viewportChanged: false,
        focusChanged: true,
      }),
    ).toBe(true)
  })

  it('does not rebuild when no update flag is set', () => {
    expect(
      shouldRebuildMarkdownDecorations({
        docChanged: false,
        selectionSet: false,
        viewportChanged: false,
        focusChanged: false,
      }),
    ).toBe(false)
  })
})

describe('shouldReplaceHorizontalRule', () => {
  it('keeps raw separator only on active line in edit mode', () => {
    expect(shouldReplaceHorizontalRule(true, true, true)).toBe(false)
    expect(shouldReplaceHorizontalRule(true, true, false)).toBe(true)
  })

  it('replaces separator when editor is blurred', () => {
    expect(shouldReplaceHorizontalRule(true, false, true)).toBe(true)
    expect(shouldReplaceHorizontalRule(true, false, false)).toBe(true)
  })

  it('always replaces separator in presentation mode', () => {
    expect(shouldReplaceHorizontalRule(false, true, true)).toBe(true)
  })
})
