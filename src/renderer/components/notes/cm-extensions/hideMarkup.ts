import type { EditorState, Range } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import { syntaxTree } from '@codemirror/language'
import { Decoration, ViewPlugin } from '@codemirror/view'
import { isStandaloneFencedCode } from './fencedCodeStyles'
import { getRevealSelection, revealSelectionChanged } from './revealSelection'

const HIDEABLE_MARKS = new Set([
  'HeaderMark',
  'EmphasisMark',
  'StrikethroughMark',
  'HighlightMark',
  'CodeMark',
  'CodeInfo',
  'LinkMark',
  'QuoteMark',
])

const LINE_BASED_MARKS = new Set(['HeaderMark', 'QuoteMark'])

interface HideMarkupOptions {
  alwaysHide?: boolean
}

export function canShowMarkup(alwaysHide: boolean, hasFocus: boolean): boolean {
  return !alwaysHide && hasFocus
}

export function shouldHideUrlNodeInMarkup(
  nodeName: string,
  parentName: string | null | undefined,
): boolean {
  if (nodeName !== 'URL') {
    return false
  }

  return parentName === 'Link' || parentName === 'Image'
}

export function shouldKeepStandaloneFencedCodeMarkup(
  nodeName: string,
  parent: SyntaxNode | null,
): boolean {
  return (
    (nodeName === 'CodeMark' || nodeName === 'CodeInfo')
    && parent !== null
    && isStandaloneFencedCode(parent)
  )
}

function isInternalLinkBracket(
  view: EditorView,
  node: { name: string, from: number, to: number },
): boolean {
  if (node.name !== 'LinkMark') {
    return false
  }

  const char = view.state.sliceDoc(node.from, node.to)

  if (char === '[') {
    return view.state.sliceDoc(node.from - 1, node.from) === '['
  }

  if (char === ']') {
    return view.state.sliceDoc(node.to, node.to + 1) === ']'
  }

  return false
}

function isCursorInRange(view: EditorView, from: number, to: number): boolean {
  for (const range of getRevealSelection(view.state).ranges) {
    if (range.from <= to && range.to >= from)
      return true
  }
  return false
}

function isCursorOnLine(view: EditorView, lineNumber: number): boolean {
  for (const range of getRevealSelection(view.state).ranges) {
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
  alwaysHide: boolean,
): boolean {
  if (!canShowMarkup(alwaysHide, view.hasFocus))
    return false

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

function buildHideDecorations(view: EditorView, alwaysHide: boolean) {
  const decorations: Range<Decoration>[] = []

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        const hideableMark = HIDEABLE_MARKS.has(node.name)
        const hideableUrl = shouldHideUrlNodeInMarkup(
          node.name,
          node.node.parent?.name,
        )

        if (!hideableMark && !hideableUrl)
          return

        if (node.from === node.to)
          return

        if (isInternalLinkBracket(view, node))
          return

        if (shouldKeepStandaloneFencedCodeMarkup(node.name, node.node.parent)) {
          return
        }

        if (shouldShowMark(view, node, alwaysHide))
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

export function createHideMarkup(options: HideMarkupOptions = {}) {
  const { alwaysHide = false } = options

  return ViewPlugin.fromClass(
    class {
      decorations = Decoration.none

      constructor(view: EditorView) {
        this.decorations = buildHideDecorations(view, alwaysHide)
      }

      update(update: {
        docChanged: boolean
        selectionSet: boolean
        viewportChanged: boolean
        focusChanged: boolean
        startState: EditorState
        state: EditorState
        view: EditorView
      }) {
        if (
          update.docChanged
          || update.selectionSet
          || update.viewportChanged
          || update.focusChanged
          || revealSelectionChanged(update)
        ) {
          this.decorations = buildHideDecorations(update.view, alwaysHide)
        }
      }
    },
    {
      decorations: v => v.decorations,
    },
  )
}

export const hideMarkup = createHideMarkup()
