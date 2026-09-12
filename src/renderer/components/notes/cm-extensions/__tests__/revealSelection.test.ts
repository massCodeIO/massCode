import type { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { afterEach, expect, it, vi } from 'vitest'
import {
  freezeRevealSelectionUntilMouseup,
  getRevealHasFocus,
  getRevealSelection,
  revealSelectionChanged,
  revealSelectionFreeze,
} from '../revealSelection'

afterEach(() => vi.unstubAllGlobals())
it.each([0, 20])(
  'does not reveal the old cursor location when clicking into an unfocused editor (new cursor %s)',
  (position) => {
    let state = EditorState.create({
      doc: '[[snippet:10]] hello world',
      extensions: [revealSelectionFreeze],
    })
    let mouseup!: () => void
    vi.stubGlobal('window', {
      addEventListener: (_name: string, callback: () => void) => {
        mouseup = callback
      },
      removeEventListener: vi.fn(),
    })
    const view = {
      get state() {
        return state
      },
      hasFocus: false,
      dom: { isConnected: true },
      dispatch(spec: Parameters<EditorState['update']>[0]) {
        state = state.update(spec).state
      },
    } as unknown as EditorView
    freezeRevealSelectionUntilMouseup(view)
    state = state.update({ selection: { anchor: position } }).state
    expect(getRevealSelection(state).main.head).toBe(0)
    expect(getRevealHasFocus(state, true)).toBe(false)
    const frozen = state
    mouseup()
    expect(getRevealHasFocus(state, true)).toBe(true)
    expect(getRevealSelection(state).main.head).toBe(position)
    expect(revealSelectionChanged({ startState: frozen, state })).toBe(true)
  },
)
