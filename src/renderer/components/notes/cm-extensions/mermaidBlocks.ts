import type { EditorState } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder, StateField } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  WidgetType,
} from '@codemirror/view'
import mermaid from 'mermaid'

interface MermaidBlocksOptions {
  enabled?: boolean
  isDark?: boolean
  showSourceWhenSelectionInside?: boolean
}

let mermaidRenderCounter = 0

function extractMermaidCode(text: string): string | null {
  const lines = text.split('\n')
  if (lines.length < 2)
    return null

  const firstLine = lines[0]?.trim() ?? ''
  const lastLine = lines.at(-1)?.trim() ?? ''

  if (!firstLine.startsWith('```') || !lastLine.startsWith('```'))
    return null

  const language = firstLine.slice(3).trim().toLowerCase()
  if (language !== 'mermaid')
    return null

  return lines.slice(1, -1).join('\n').trim()
}

function isSelectionInsideRange(
  state: EditorState,
  from: number,
  to: number,
): boolean {
  for (const range of state.selection.ranges) {
    if (range.empty) {
      if (range.from >= from && range.from <= to)
        return true
      continue
    }

    if (range.from <= to && range.to >= from)
      return true
  }

  return false
}

async function renderMermaid(
  container: HTMLElement,
  code: string,
  isDark: boolean,
) {
  try {
    const id = `notes-mermaid-${mermaidRenderCounter++}`

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: isDark ? 'dark' : 'default',
    })

    const result = await mermaid.render(id, code)
    const svg = typeof result === 'string' ? result : result.svg
    container.innerHTML = svg
  }
  catch {
    const fallback = document.createElement('pre')
    fallback.className = 'text-muted-foreground overflow-auto text-xs'
    fallback.textContent = code

    container.innerHTML = ''
    container.append(fallback)
  }
}

class MermaidWidget extends WidgetType {
  constructor(
    readonly code: string,
    readonly isDark: boolean,
    readonly activateSourceOnClick: boolean,
  ) {
    super()
  }

  eq(other: MermaidWidget): boolean {
    return (
      this.code === other.code
      && this.isDark === other.isDark
      && this.activateSourceOnClick === other.activateSourceOnClick
    )
  }

  toDOM(view: EditorView): HTMLElement {
    const root = document.createElement('div')
    root.className = this.activateSourceOnClick
      ? 'my-3 cursor-text overflow-auto rounded-md border border-border p-4'
      : 'my-3 overflow-auto rounded-md border border-border p-4'

    if (this.activateSourceOnClick) {
      root.addEventListener('mousedown', (event) => {
        event.preventDefault()
        const sourceFrom = view.posAtDOM(root, 0)
        const anchor = Math.min(sourceFrom + 1, view.state.doc.length)
        view.dispatch({
          selection: { anchor },
          scrollIntoView: true,
        })
        view.focus()
      })
    }

    void renderMermaid(root, this.code, this.isDark)

    return root
  }
}

function buildDecorations(
  state: EditorState,
  enabled: boolean,
  isDark: boolean,
  showSourceWhenSelectionInside: boolean,
) {
  if (!enabled)
    return Decoration.none

  const builder = new RangeSetBuilder<Decoration>()

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== 'FencedCode')
        return

      if (
        showSourceWhenSelectionInside
        && isSelectionInsideRange(state, node.from, node.to)
      ) {
        return
      }

      const code = extractMermaidCode(state.sliceDoc(node.from, node.to))
      if (!code)
        return

      builder.add(
        node.from,
        node.to,
        Decoration.replace({
          block: true,
          widget: new MermaidWidget(
            code,
            isDark,
            showSourceWhenSelectionInside,
          ),
        }),
      )
    },
  })

  return builder.finish()
}

export function createMermaidBlocks(options: MermaidBlocksOptions = {}) {
  const {
    enabled = true,
    isDark = false,
    showSourceWhenSelectionInside = false,
  } = options

  return StateField.define<DecorationSet>({
    create(state) {
      return buildDecorations(
        state,
        enabled,
        isDark,
        showSourceWhenSelectionInside,
      )
    },
    update(decorations, transaction) {
      const selectionChanged = !transaction.startState.selection.eq(
        transaction.state.selection,
      )

      if (transaction.docChanged || selectionChanged) {
        return buildDecorations(
          transaction.state,
          enabled,
          isDark,
          showSourceWhenSelectionInside,
        )
      }

      return decorations.map(transaction.changes)
    },
    provide: field => EditorView.decorations.from(field),
  })
}

export const mermaidBlocks = createMermaidBlocks()
