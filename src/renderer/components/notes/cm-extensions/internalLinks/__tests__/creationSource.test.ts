import type { EditorView } from '@codemirror/view'
import { history, undo } from '@codemirror/commands'
import { EditorState } from '@codemirror/state'
import { describe, expect, it, vi } from 'vitest'
import { captureNoteLinkSource } from '../creationSource'

function setup(id = 1) {
  let state = EditorState.create({
    doc: 'prefix [[new',
    extensions: [history()],
  })
  const identity = { id, generation: 0 }
  let capture: ReturnType<typeof captureNoteLinkSource>
  const view = {
    get state() {
      return state
    },
    dom: { inert: false },
    focus: vi.fn(),
    dispatch(spec: Parameters<EditorState['update']>[0]) {
      const transaction = state.update(spec)
      capture?.update(transaction.changes)
      state = transaction.state
    },
  } as unknown as EditorView
  capture = captureNoteLinkSource(view, () => identity, { from: 7, to: 12 })!
  return { view, capture: capture!, identity }
}
describe('owned Notes creation occurrence', () => {
  it.each([1, 2])(
    'maps edits before the occurrence in editor %s and inserts one isolated undo transaction',
    (id) => {
      const { view, capture } = setup(id)
      view.dispatch({ changes: { from: 0, insert: 'more ' } })
      expect(capture.source.valid()).toBe(true)
      capture.source.insert('[[note:9|new]]')
      expect(view.state.doc.toString()).toBe('more prefix [[note:9|new]]')
      undo(view)
      expect(view.state.doc.toString()).toBe('more prefix [[new')
      expect(capture.source.valid()).toBe(false)
    },
  )
  it('keeps the occurrence when typing immediately before or after it', () => {
    const { view, capture } = setup()
    view.dispatch({ changes: { from: 12, insert: ' after' } })
    view.dispatch({ changes: { from: 7, insert: 'before ' } })
    expect(capture.source.valid()).toBe(true)
    capture.source.insert('[[note:9|new]]')
    expect(view.state.doc.toString()).toBe(
      'prefix before [[note:9|new]] after',
    )
  })
  it('invalidates intersecting edits, replacement/ABA and destruction', () => {
    const edited = setup()
    edited.view.dispatch({ changes: { from: 9, to: 10, insert: 'x' } })
    expect(edited.capture.source.valid()).toBe(false)
    const changed = setup()
    changed.identity.id = 2
    changed.identity.generation++
    changed.identity.id = 1
    expect(changed.capture.source.valid()).toBe(false)
    const destroyed = setup()
    destroyed.capture.invalidate()
    expect(destroyed.capture.source.valid()).toBe(false)
  })
  it('rejects read-only capture and restores the previous inert state after commit', () => {
    const { view, capture } = setup()
    const unlock = capture.source.lock()
    expect(view.dom.inert).toBe(true)
    unlock()
    expect(view.dom.inert).toBe(false)
    const readonly = {
      state: EditorState.create({
        doc: '[[new',
        extensions: [EditorState.readOnly.of(true)],
      }),
    } as EditorView
    expect(
      captureNoteLinkSource(readonly, () => ({ id: 1, generation: 0 }), {
        from: 0,
        to: 5,
      }),
    ).toBeUndefined()
  })
})
