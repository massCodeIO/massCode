import type { TransactionSpec } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { EditorSelection, EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import {
  toggleBulletList,
  toggleOrderedList,
  toggleTaskList,
} from '../editorCommands'

function runCommand(
  doc: string,
  command: (view: EditorView) => void,
  selection = EditorSelection.single(0),
) {
  let state = EditorState.create({ doc, selection })
  const view = {
    get state() {
      return state
    },
    dispatch(...specs: TransactionSpec[]) {
      state = state.update(...specs).state
    },
    focus() {},
  } as EditorView

  command(view)

  return {
    doc: state.doc.toString(),
    head: state.selection.main.head,
  }
}

describe('editorCommands lists', () => {
  it('adds a bullet marker on an empty line', () => {
    expect(runCommand('', toggleBulletList)).toEqual({
      doc: '- ',
      head: 2,
    })
  })

  it('adds an ordered marker on an empty line', () => {
    expect(runCommand('', toggleOrderedList)).toEqual({
      doc: '1. ',
      head: 3,
    })
  })

  it('adds a task marker on an empty line', () => {
    expect(runCommand('', toggleTaskList)).toEqual({
      doc: '- [ ] ',
      head: 6,
    })
  })

  it('keeps blank lines inside multi-line selections untouched', () => {
    const doc = ['first', '', 'second'].join('\n')
    const result = runCommand(
      doc,
      toggleBulletList,
      EditorSelection.range(0, doc.length),
    )

    expect(result.doc).toBe(['- first', '', '- second'].join('\n'))
  })
})
