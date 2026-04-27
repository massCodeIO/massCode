import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { EditorState } from '@codemirror/state'
import { GFM } from '@lezer/markdown'
import { describe, expect, it } from 'vitest'
import {
  getFallbackListMarkerRanges,
  shouldRebuildMarkdownDecorations,
  shouldReplaceHorizontalRule,
  shouldReplaceTaskMarker,
} from '../markdownDecorations'

function createMarkdownState(doc: string) {
  return EditorState.create({
    doc,
    extensions: [
      markdown({
        base: markdownLanguage,
        codeLanguages: languages,
        extensions: GFM,
      }),
    ],
  })
}

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

describe('getFallbackListMarkerRanges', () => {
  it('finds ordered markers that markdown parser treats as paragraph text', () => {
    const doc = [
      '1. a',
      '2. b',
      '  1. c',
      '  2. d',
      '    1. e',
      '    2. f',
      '      1. g',
      '      2. h',
    ].join('\n')
    const state = createMarkdownState(doc)

    const ranges = getFallbackListMarkerRanges(state)

    expect(
      ranges.map(range => ({
        line: state.doc.lineAt(range.from).number,
        text: state.sliceDoc(range.from, range.to),
      })),
    ).toEqual([
      { line: 5, text: '1.' },
      { line: 6, text: '2.' },
    ])
  })

  it('does not find fallback markers inside fenced code', () => {
    const state = createMarkdownState(['```', '1. code', '```'].join('\n'))

    expect(getFallbackListMarkerRanges(state)).toEqual([])
  })
})
