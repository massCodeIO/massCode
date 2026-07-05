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
import { editorFocusField, setEditorFocusEffect } from './editorFocus'
import { getRevealSelection, revealSelectionChanged } from './revealSelection'
import { isSelectionInsideRangeWithFocus } from './selectionRange'

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
  const hasFocus = state.field(editorFocusField, false) ?? false

  for (const range of getRevealSelection(state).ranges) {
    if (
      isSelectionInsideRangeWithFocus(
        hasFocus,
        range.from,
        range.to,
        from,
        to,
        range.empty,
      )
    ) {
      return true
    }
  }

  return false
}

export function applyMermaidRenderSuccess(container: HTMLElement, svg: string) {
  container.style.display = ''
  container.innerHTML = svg
}

export function applyMermaidRenderFailure(
  container: HTMLElement,
  error: unknown,
) {
  console.error('[notes] Failed to render mermaid diagram', error)
  container.innerHTML = ''
  container.style.display = 'none'
}

// Rendered SVG markup keyed by `${code}|${theme}`. mermaid.render is
// expensive and CodeMirror re-creates widgets every time the selection
// enters/leaves a block range, so cache aggressively (same pattern as
// svgCache in drawingEmbed.ts).
const svgCache = new Map<string, string>()
const inFlightRenders = new Map<string, Promise<string>>()
let initializedTheme: string | null = null

async function renderMermaidSvg(
  code: string,
  theme: 'dark' | 'default',
): Promise<string> {
  const id = `notes-mermaid-${mermaidRenderCounter++}`

  if (initializedTheme !== theme) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme,
    })
    initializedTheme = theme
  }

  const result = await mermaid.render(id, code)
  return typeof result === 'string' ? result : result.svg
}

async function renderMermaid(
  container: HTMLElement,
  code: string,
  isDark: boolean,
) {
  const theme = isDark ? 'dark' : 'default'
  const cacheKey = `${code}|${theme}`

  try {
    const cached = svgCache.get(cacheKey)

    if (cached !== undefined) {
      applyMermaidRenderSuccess(container, cached)
      return
    }

    let render = inFlightRenders.get(cacheKey)

    if (!render) {
      render = renderMermaidSvg(code, theme).finally(() => {
        inFlightRenders.delete(cacheKey)
      })
      inFlightRenders.set(cacheKey, render)
    }

    const svg = await render
    svgCache.set(cacheKey, svg)
    applyMermaidRenderSuccess(container, svg)
  }
  catch (error) {
    applyMermaidRenderFailure(container, error)
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
        const blockFrom = view.posAtDOM(root, 0)
        const codeLines = this.code.split('\n')
        const totalLines = codeLines.length + 2 // opening fence + code + closing fence
        const rootRect = root.getBoundingClientRect()
        const clickY = event.clientY - rootRect.top
        const ratio
          = rootRect.height > 0
            ? Math.max(0, Math.min(1, clickY / rootRect.height))
            : 0
        const lineIndex = Math.min(
          Math.floor(ratio * totalLines),
          totalLines - 1,
        )
        const blockStartLine = view.state.doc.lineAt(blockFrom).number
        const targetLineNumber = Math.min(
          blockStartLine + lineIndex,
          view.state.doc.lines,
        )
        const anchor = view.state.doc.line(targetLineNumber).from
        view.dispatch({
          selection: { anchor },
          effects: setEditorFocusEffect.of(true),
          scrollIntoView: true,
        })
        view.focus()
      })
    }

    void renderMermaid(root, this.code, this.isDark)

    return root
  }
}

interface MermaidBlocksFieldValue {
  decorations: DecorationSet
  blocks: { from: number, to: number }[]
}

function buildDecorations(
  state: EditorState,
  enabled: boolean,
  isDark: boolean,
  showSourceWhenSelectionInside: boolean,
): MermaidBlocksFieldValue {
  if (!enabled)
    return { blocks: [], decorations: Decoration.none }

  const builder = new RangeSetBuilder<Decoration>()
  const blocks: { from: number, to: number }[] = []

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== 'FencedCode')
        return

      const code = extractMermaidCode(state.sliceDoc(node.from, node.to))
      if (!code)
        return

      blocks.push({ from: node.from, to: node.to })

      if (
        showSourceWhenSelectionInside
        && isSelectionInsideRange(state, node.from, node.to)
      ) {
        return
      }

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

  return { blocks, decorations: builder.finish() }
}

export function createMermaidBlocks(options: MermaidBlocksOptions = {}) {
  const {
    enabled = true,
    isDark = false,
    showSourceWhenSelectionInside = false,
  } = options

  return StateField.define<MermaidBlocksFieldValue>({
    create(state) {
      return buildDecorations(
        state,
        enabled,
        isDark,
        showSourceWhenSelectionInside,
      )
    },
    update(value, transaction) {
      const focusChanged = transaction.effects.some(e =>
        e.is(setEditorFocusEffect),
      )
      // The syntax tree can advance asynchronously (without a document
      // change), so compare tree identity to pick up late-parsed blocks.
      const treeChanged
        = syntaxTree(transaction.startState) !== syntaxTree(transaction.state)

      if (transaction.docChanged || focusChanged || treeChanged) {
        return buildDecorations(
          transaction.state,
          enabled,
          isDark,
          showSourceWhenSelectionInside,
        )
      }

      // A pure selection change only matters when the cursor enters or
      // leaves one of the current blocks. Unfreezing the reveal selection
      // (mouseup after a drag) changes the effective selection too.
      if (
        showSourceWhenSelectionInside
        && (revealSelectionChanged(transaction)
          || !transaction.startState.selection.eq(transaction.state.selection))
        && value.blocks.some(
          block =>
            isSelectionInsideRange(
              transaction.startState,
              block.from,
              block.to,
            )
            !== isSelectionInsideRange(transaction.state, block.from, block.to),
        )
      ) {
        return buildDecorations(
          transaction.state,
          enabled,
          isDark,
          showSourceWhenSelectionInside,
        )
      }

      return value
    },
    provide: field =>
      EditorView.decorations.from(field, value => value.decorations),
  })
}

export const mermaidBlocks = createMermaidBlocks()
