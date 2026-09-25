import type { EditorView } from '@codemirror/view'
import type { EditSnapshot } from './edit'
import { matchesSnapshot } from './edit'

export function readNotesEditor(
  view: Pick<EditorView, 'state'> | null,
  noteId: number | undefined,
  disabled: boolean,
) {
  if (!view || disabled || noteId === undefined)
    return undefined
  const selection = view.state.selection.main
  return {
    space: 'notes' as const,
    noteId,
    text: view.state.doc.toString(),
    language: 'markdown',
    selection: view.state.sliceDoc(selection.from, selection.to),
    selectionFrom:
      view.state.selection.ranges.length === 1 ? selection.from : undefined,
    selectionTo:
      view.state.selection.ranges.length === 1 ? selection.to : undefined,
  }
}
export function applyNotesEditor(
  view: Pick<EditorView, 'state' | 'dispatch'> | null,
  noteId: number | undefined,
  disabled: boolean,
  snapshot: EditSnapshot,
  replacement: string,
  vault: string,
) {
  if (
    !view
    || !matchesSnapshot(snapshot, readNotesEditor(view, noteId, disabled), vault)
  ) {
    return false
  }
  view.dispatch({
    changes: { from: snapshot.from, to: snapshot.to, insert: replacement },
    userEvent: 'input.ai',
  })
  return true
}
