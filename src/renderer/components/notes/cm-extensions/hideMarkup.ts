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

const FENCED_CODE_MARKS = new Set(['CodeMark', 'CodeInfo'])

function getCursorLineNumbers(view: EditorView): Set<number> {
  const lines = new Set<number>()
  for (const range of view.state.selection.ranges) {
    const startLine = view.state.doc.lineAt(range.from).number
    const endLine = view.state.doc.lineAt(range.to).number
    for (let i = startLine; i <= endLine; i++) {
      lines.add(i)
    }
  }
  return lines
}

function isCursorInsideFencedCode(
  view: EditorView,
  cursorLines: Set<number>,
  nodeFrom: number,
): boolean {
  let fencedCode: { from: number, to: number } | null = null

  syntaxTree(view.state).iterate({
    from: nodeFrom,
    to: nodeFrom,
    enter(n) {
      if (n.name === 'FencedCode') {
        fencedCode = { from: n.from, to: n.to }
      }
    },
  })

  if (!fencedCode)
    return false

  const { from, to } = fencedCode
  const startLine = view.state.doc.lineAt(from).number
  const endLine = view.state.doc.lineAt(to).number

  for (let i = startLine; i <= endLine; i++) {
    if (cursorLines.has(i))
      return true
  }
  return false
}

function buildHideDecorations(view: EditorView) {
  const decorations: Range<Decoration>[] = []
  const cursorLines = getCursorLineNumbers(view)

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        if (!HIDEABLE_MARKS.has(node.name))
          return

        if (node.from === node.to)
          return

        if (FENCED_CODE_MARKS.has(node.name)) {
          if (isCursorInsideFencedCode(view, cursorLines, node.from))
            return
        }
        else {
          const line = view.state.doc.lineAt(node.from)
          if (cursorLines.has(line.number))
            return
        }

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
