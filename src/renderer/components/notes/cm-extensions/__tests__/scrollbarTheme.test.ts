import { describe, expect, it } from 'vitest'
import { notesEditorScrollbarTheme } from '../scrollbarTheme'

describe('notesEditorScrollbarTheme', () => {
  it('applies custom scrollbar styles to cm scroller', () => {
    expect(notesEditorScrollbarTheme['.cm-scroller']).toEqual({
      overflow: 'auto',
      scrollbarWidth: 'auto',
      scrollbarColor: 'var(--scrollbar) transparent',
    })
  })

  it('defines webkit scrollbar parts', () => {
    expect(
      notesEditorScrollbarTheme['.cm-scroller::-webkit-scrollbar'],
    ).toEqual({
      width: '6px',
      height: '6px',
    })

    expect(
      notesEditorScrollbarTheme['.cm-scroller::-webkit-scrollbar-track'],
    ).toEqual({
      background: 'transparent',
    })

    expect(
      notesEditorScrollbarTheme['.cm-scroller::-webkit-scrollbar-thumb'],
    ).toEqual({
      backgroundColor: 'var(--scrollbar)',
      borderRadius: '3px',
    })
  })
})
