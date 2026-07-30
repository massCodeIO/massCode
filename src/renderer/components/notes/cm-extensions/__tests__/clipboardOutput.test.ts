import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { createClipboardOutput } from '../clipboardOutput'

function filterClipboardOutput(text: string, isWindows: boolean) {
  const state = EditorState.create({
    extensions: [createClipboardOutput(isWindows)],
  })

  return state
    .facet(EditorView.clipboardOutputFilter)
    .reduce((output, filter) => filter(output, state), text)
}

describe('clipboard output', () => {
  it('converts LF line endings to CRLF on Windows', () => {
    expect(filterClipboardOutput('first\nsecond\nthird', true)).toBe(
      'first\r\nsecond\r\nthird',
    )
  })

  it('does not duplicate CR in existing CRLF line endings on Windows', () => {
    expect(filterClipboardOutput('first\r\nsecond', true)).toBe(
      'first\r\nsecond',
    )
  })

  it('leaves line endings unchanged on macOS and Linux', () => {
    expect(filterClipboardOutput('first\nsecond', false)).toBe('first\nsecond')
  })

  it('leaves text without line endings unchanged', () => {
    expect(filterClipboardOutput('single line', true)).toBe('single line')
  })
})
