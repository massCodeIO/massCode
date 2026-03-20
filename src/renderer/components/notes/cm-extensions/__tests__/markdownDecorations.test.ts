import { describe, expect, it } from 'vitest'
import {
  shouldRebuildMarkdownDecorations,
  shouldReplaceHorizontalRule,
  shouldReplaceTaskMarker,
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

describe('shouldReplaceTaskMarker', () => {
  it('replaces when cursor is not on marker line and editor is focused', () => {
    expect(shouldReplaceTaskMarker(true, true, false)).toBe(true)
  })

  it('shows raw when cursor is on marker line and editor is focused', () => {
    expect(shouldReplaceTaskMarker(true, true, true)).toBe(false)
  })

  it('replaces when editor is not focused', () => {
    expect(shouldReplaceTaskMarker(true, false, true)).toBe(true)
  })

  it('always replaces in non-interactive mode (presentation)', () => {
    expect(shouldReplaceTaskMarker(false, true, true)).toBe(true)
    expect(shouldReplaceTaskMarker(false, false, false)).toBe(true)
  })
})
