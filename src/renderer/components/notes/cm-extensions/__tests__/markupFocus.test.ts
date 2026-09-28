import type { DecorationSet, EditorView } from '@codemirror/view'
import { markdown } from '@codemirror/lang-markdown'
import { EditorState, RangeSet } from '@codemirror/state'
import { ViewPlugin } from '@codemirror/view'
import { GFM } from '@lezer/markdown'
import { afterEach, expect, it, vi } from 'vitest'
import { createHideMarkup } from '../hideMarkup'
import { createMarkdownDecorations } from '../markdownDecorations'
import {
  freezeRevealSelectionUntilMouseup,
  revealSelectionFreeze,
} from '../revealSelection'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it.each([
  ['# Heading', createHideMarkup],
  ['**Bold**', createHideMarkup],
  ['*Italic*', createHideMarkup],
  ['[Link](https://example.com)', createHideMarkup],
  ['---', createMarkdownDecorations],
  ['- [ ] Task', createMarkdownDecorations],
  ['> [!NOTE]', createMarkdownDecorations],
])(
  'keeps first-line markup hidden while focusing below %s',
  (firstLine, createPlugin) => {
    let state = EditorState.create({
      doc: `${firstLine}\n\nPlain text`,
      extensions: [markdown({ extensions: GFM }), revealSelectionFreeze],
    })
    let mouseup!: () => void
    vi.stubGlobal('window', {
      addEventListener: (_name: string, callback: () => void) => {
        mouseup = callback
      },
      removeEventListener: vi.fn(),
    })
    let focused = false
    const view = {
      get state() {
        return state
      },
      get hasFocus() {
        return focused
      },
      visibleRanges: [{ from: 0, to: state.doc.length }],
      dom: { isConnected: true },
      dispatch(spec: Parameters<EditorState['update']>[0]) {
        state = state.update(spec).state
      },
    } as unknown as EditorView
    const fromClass = vi.spyOn(ViewPlugin, 'fromClass')
    createPlugin()
    const Plugin = fromClass.mock.calls[0]![0]
    const decorations = () =>
      (new Plugin(view, undefined) as { decorations: DecorationSet })
        .decorations
    const beforeFocus = decorations()
    expect(beforeFocus.size).toBeGreaterThan(0)

    freezeRevealSelectionUntilMouseup(view)
    focused = true
    expect(RangeSet.eq([decorations()], [beforeFocus])).toBe(true)
    state = state.update({ selection: { anchor: state.doc.length } }).state
    expect(RangeSet.eq([decorations()], [beforeFocus])).toBe(true)
    mouseup()
    expect(RangeSet.eq([decorations()], [beforeFocus])).toBe(true)

    state = state.update({ selection: { anchor: 0 } }).state
    expect(RangeSet.eq([decorations()], [beforeFocus])).toBe(false)
  },
)
