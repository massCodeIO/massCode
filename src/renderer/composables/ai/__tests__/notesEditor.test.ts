import { EditorState } from '@codemirror/state'
import { expect, it, vi } from 'vitest'
import { applyNotesEditor, readNotesEditor } from '../notesEditor'

it('applies the exact note range through a CodeMirror transaction and rejects stale identities/content', () => {
  const changed = vi.fn()
  const view = {
    state: EditorState.create({
      doc: '# Title\nText',
      selection: { anchor: 8, head: 12 },
    }),
    dispatch: vi.fn((spec: any) => {
      const transaction = view.state.update(spec)
      view.state = transaction.state
      if (transaction.docChanged)
        changed(view.state.doc.toString())
    }),
  }
  const context = readNotesEditor(view, 7, false)!
  const snapshot = {
    ...context,
    contextId: crypto.randomUUID(),
    vault: '/vault',
    from: 8,
    to: 12,
  }
  expect(applyNotesEditor(view, 8, false, snapshot, 'Changed', '/vault')).toBe(
    false,
  )
  expect(applyNotesEditor(view, 7, true, snapshot, 'Changed', '/vault')).toBe(
    false,
  )
  expect(applyNotesEditor(view, 7, false, snapshot, 'Changed', '/other')).toBe(
    false,
  )
  expect(applyNotesEditor(view, 7, false, snapshot, 'Changed', '/vault')).toBe(
    true,
  )
  expect(changed).toHaveBeenCalledExactlyOnceWith('# Title\nChanged')
  expect(applyNotesEditor(view, 7, false, snapshot, 'Again', '/vault')).toBe(
    false,
  )
  expect(readNotesEditor({ state: EditorState.create() }, 9, false)?.text).toBe(
    '',
  )
})
