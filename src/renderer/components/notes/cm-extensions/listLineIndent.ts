import type { Range } from '@codemirror/state'
import type { EditorView, ViewUpdate } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { Decoration, ViewPlugin } from '@codemirror/view'
import { shouldReplaceTaskMarker } from './markdownDecorations'

const BASE_INDENT_PX = 14
const CHECKBOX_WIDGET_PX = 24

const LIST_PREFIX_RE = /^(\s*(?:[-*+]|\d+\.)\s)(?:(\[[ x]\])\s)?/i

export function parseListPrefix(text: string) {
  return text.match(LIST_PREFIX_RE)
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

interface ListLineIndentOptions {
  interactiveTaskMarkers?: boolean
}

export function createListLineIndent(options: ListLineIndentOptions = {}) {
  const { interactiveTaskMarkers = true } = options

  return ViewPlugin.fromClass(
    class {
      decorations = Decoration.none
      private ruler: HTMLSpanElement
      private widthCache = new Map<string, number>()

      constructor(view: EditorView) {
        this.ruler = document.createElement('span')
        Object.assign(this.ruler.style, {
          position: 'absolute',
          visibility: 'hidden',
          height: '0',
          overflow: 'hidden',
          whiteSpace: 'pre',
          pointerEvents: 'none',
        })
        view.contentDOM.appendChild(this.ruler)
        this.decorations = this.build(view)
      }

      private measure(text: string): number {
        const cached = this.widthCache.get(text)
        if (cached !== undefined)
          return cached
        this.ruler.textContent = text
        const width = this.ruler.getBoundingClientRect().width
        if (width > 0) {
          this.widthCache.set(text, width)
        }
        return width
      }

      private build(view: EditorView) {
        const decorations: Range<Decoration>[] = []
        const processedLines = new Set<number>()
        const measure = this.measure.bind(this)

        const taskMarkersByLine = new Map<
          number,
          { from: number, to: number }
        >()

        for (const { from, to } of view.visibleRanges) {
          syntaxTree(view.state).iterate({
            from,
            to,
            enter(node) {
              if (node.name === 'TaskMarker') {
                const line = view.state.doc.lineAt(node.from)
                taskMarkersByLine.set(line.number, {
                  from: node.from,
                  to: node.to,
                })
              }
            },
          })
        }

        for (const { from, to } of view.visibleRanges) {
          syntaxTree(view.state).iterate({
            from,
            to,
            enter(node) {
              if (node.name !== 'ListMark')
                return

              const line = view.state.doc.lineAt(node.from)
              if (processedLines.has(line.number))
                return
              processedLines.add(line.number)

              const match = parseListPrefix(line.text)
              if (!match)
                return

              const taskMarker = taskMarkersByLine.get(line.number)
              let indentPx: number

              if (taskMarker) {
                const widgetShown = shouldReplaceTaskMarker(
                  interactiveTaskMarkers,
                  view.hasFocus,
                  isCursorOnLine(view, line.number),
                )

                if (widgetShown) {
                  const textBefore = view.state.sliceDoc(
                    line.from,
                    taskMarker.from,
                  )
                  const charAfter = view.state.sliceDoc(
                    taskMarker.to,
                    taskMarker.to + 1,
                  )
                  const spacer = charAfter === ' ' ? ' ' : ''
                  indentPx = measure(textBefore + spacer) + CHECKBOX_WIDGET_PX
                }
                else {
                  indentPx = measure(match[0])
                }
              }
              else {
                indentPx = measure(match[1])
              }

              const px = Math.round(indentPx * 10) / 10
              const padPx = Math.round((indentPx + BASE_INDENT_PX) * 10) / 10

              decorations.push(
                Decoration.line({
                  attributes: {
                    style: `text-indent:-${px}px;padding-inline-start:${padPx}px`,
                  },
                }).range(line.from),
              )
            },
          })
        }

        return Decoration.set(decorations, true)
      }

      update(update: ViewUpdate) {
        if (
          update.docChanged
          || update.viewportChanged
          || update.selectionSet
          || update.focusChanged
        ) {
          if (update.geometryChanged) {
            this.widthCache.clear()
          }
          this.decorations = this.build(update.view)
        }
      }

      destroy() {
        this.ruler.remove()
      }
    },
    {
      decorations: v => v.decorations,
    },
  )
}
