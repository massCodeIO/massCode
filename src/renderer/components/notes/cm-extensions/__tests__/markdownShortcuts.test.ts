import { describe, expect, it } from 'vitest'
import { markdownShortcuts, toggleInlineMarkdown } from '../markdownShortcuts'

describe('toggleInlineMarkdown', () => {
  it('wraps selected text with bold markers', () => {
    expect(toggleInlineMarkdown('hello world', 0, 5, '**')).toEqual({
      selection: {
        from: 2,
        to: 7,
      },
      text: '**hello** world',
    })
  })

  it('unwraps selected text when bold markers are adjacent to the selection', () => {
    expect(toggleInlineMarkdown('**hello** world', 2, 7, '**')).toEqual({
      selection: {
        from: 0,
        to: 5,
      },
      text: 'hello world',
    })
  })

  it('unwraps selected text when the selection already includes the markers', () => {
    expect(toggleInlineMarkdown('**hello** world', 0, 9, '**')).toEqual({
      selection: {
        from: 0,
        to: 5,
      },
      text: 'hello world',
    })
  })

  it('inserts italic markers around an empty selection and places cursor between them', () => {
    expect(toggleInlineMarkdown('hello', 5, 5, '*')).toEqual({
      selection: {
        from: 6,
        to: 6,
      },
      text: 'hello**',
    })
  })

  it('wraps selected text with strikethrough markers', () => {
    expect(toggleInlineMarkdown('hello world', 6, 11, '~~')).toEqual({
      selection: {
        from: 8,
        to: 13,
      },
      text: 'hello ~~world~~',
    })
  })
})

describe('markdownShortcuts', () => {
  it('registers bold, italic, and strikethrough shortcuts', () => {
    expect(markdownShortcuts.map(binding => binding.key)).toEqual([
      'Mod-b',
      'Mod-i',
      'Mod-Shift-s',
    ])
  })
})
