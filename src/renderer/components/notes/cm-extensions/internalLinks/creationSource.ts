import type { ChangeDesc } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { isolateHistory } from '@codemirror/commands'

export interface NoteLinkSource {
  noteId: number
  valid: () => boolean
  insert: (link: string) => void
  lock: () => () => void
  release: () => void
  focus: () => void
}
export function captureNoteLinkSource(
  view: EditorView,
  identity: () => { id: number, generation: number } | undefined,
  range: { from: number, to: number },
  release: () => void = () => {},
) {
  const current = identity()
  if (!current || view.state.readOnly)
    return
  const owner = { ...current }
  let from = range.from
  let to = range.to
  let expected = view.state.doc.sliceString(from, to)
  let alive = true
  let inserting = false
  const valid = () =>
    alive
    && !view.state.readOnly
    && identity()?.id === owner.id
    && identity()?.generation === owner.generation
    && view.state.doc.sliceString(from, to) === expected
  const source: NoteLinkSource = {
    noteId: owner.id,
    focus() {
      if (valid()) {
        view.dispatch({ selection: { anchor: to } })
        view.focus()
      }
    },
    valid,
    insert(link) {
      if (!valid())
        throw new Error('LINK_SOURCE_CHANGED')
      inserting = true
      try {
        view.dispatch({
          changes: { from, to, insert: link },
          selection: { anchor: from + link.length },
          annotations: isolateHistory.of('full'),
        })
        expected = link
        to = from + link.length
      }
      finally {
        inserting = false
      }
    },
    lock() {
      const previous = view.dom.inert
      view.dom.inert = true
      return () => {
        view.dom.inert = previous
      }
    },
    release() {
      alive = false
      release()
    },
  }
  return {
    source,
    matches: (range: { from: number, to: number }) =>
      valid() && range.from === from && range.to === to,
    invalidate: () => {
      alive = false
    },
    update(changes: ChangeDesc) {
      if (!alive || inserting)
        return
      changes.iterChangedRanges((start, end) => {
        if (start < to && end > from)
          alive = false
      })
      if (alive) {
        from = changes.mapPos(from, 1)
        to = changes.mapPos(to, -1)
      }
    },
  }
}
