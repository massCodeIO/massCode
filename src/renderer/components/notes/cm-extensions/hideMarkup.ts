import type { Range } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { Decoration, ViewPlugin } from '@codemirror/view'

const HIDEABLE_MARKS = new Set([
  'HeaderMark',
  'EmphasisMark',
  'StrikethroughMark',
  'CodeMark',
  'CodeInfo',
  'LinkMark',
  'QuoteMark',
])

const LINE_BASED_MARKS = new Set(['HeaderMark', 'QuoteMark'])

function isCursorInRange(view: EditorView, from: number, to: number): boolean {
  for (const range of view.state.selection.ranges) {
    if (range.from >= from && range.from <= to)
      return true
    if (range.to >= from && range.to <= to)
      return true
  }
  return false
}

function isCursorOnLine(view: EditorView, lineNumber: number): boolean {
  for (const range of view.state.selection.ranges) {
    const startLine = view.state.doc.lineAt(range.from).number
    const endLine = view.state.doc.lineAt(range.to).number
    if (lineNumber >= startLine && lineNumber <= endLine)
      return true
  }
  return false
}

function shouldShowMark(
  view: EditorView,
  node: {
    name: string
    from: number
    to: number
    node: { parent: { name: string, from: number, to: number } | null }
  },
): boolean {
  if (LINE_BASED_MARKS.has(node.name)) {
    const line = view.state.doc.lineAt(node.from)
    return isCursorOnLine(view, line.number)
  }

  const parent = node.node.parent
  if (!parent)
    return false

  if (parent.name === 'FencedCode') {
    return isCursorInRange(view, parent.from, parent.to)
  }

  return isCursorInRange(view, parent.from, parent.to)
}

function buildHideDecorations(view: EditorView) {
  const decorations: Range<Decoration>[] = []

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        if (!HIDEABLE_MARKS.has(node.name))
          return

        if (node.from === node.to)
          return

        if (shouldShowMark(view, node))
          return

        let end = node.to
        if (node.name === 'HeaderMark') {
          const after = view.state.sliceDoc(node.to, node.to + 1)
          if (after === ' ')
            end = node.to + 1
        }

        decorations.push(Decoration.replace({}).range(node.from, end))
      },
    })
  }

  return Decoration.set(decorations, true)
}

export const hideMarkup = ViewPlugin.fromClass(
  class {
    decorations = Decoration.none

    constructor(view: EditorView) {
      this.decorations = buildHideDecorations(view)
    }

    update(update: {
      docChanged: boolean
      selectionSet: boolean
      viewportChanged: boolean
      view: EditorView
    }) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildHideDecorations(update.view)
      }
    }
  },
  {
    decorations: v => v.decorations,
  },
)
