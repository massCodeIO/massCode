import type { EditorState } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder, StateField } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  WidgetType,
} from '@codemirror/view'
import { editorFocusField, setEditorFocusEffect } from './editorFocus'
import { isSelectionInsideRangeWithFocus } from './selectionRange'

interface TableBlocksOptions {
  enabled?: boolean
  showSourceWhenSelectionInside?: boolean
}

interface ParsedMarkdownTable {
  header: string[]
  rows: string[][]
}

export function parseTableRow(line: string): string[] {
  const trimmed = line.trim()
  if (!trimmed.includes('|'))
    return []

  const withoutStartPipe = trimmed.startsWith('|') ? trimmed.slice(1) : trimmed
  const withoutEdgePipes = withoutStartPipe.endsWith('|')
    ? withoutStartPipe.slice(0, -1)
    : withoutStartPipe

  return withoutEdgePipes.split('|').map(cell => cell.trim())
}

export function isTableDelimiterCell(cell: string): boolean {
  return /^:?-{3,}:?$/.test(cell.trim())
}

export function parseMarkdownTable(source: string): ParsedMarkdownTable | null {
  const lines = source
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  if (lines.length < 2)
    return null

  const header = parseTableRow(lines[0] ?? '')
  const delimiter = parseTableRow(lines[1] ?? '')
  if (header.length < 2 || header.length !== delimiter.length)
    return null

  if (!delimiter.every(isTableDelimiterCell))
    return null

  const rows: string[][] = []
  for (const line of lines.slice(2)) {
    const cells = parseTableRow(line)
    if (cells.length === 0)
      continue

    if (cells.length !== header.length)
      return null

    rows.push(cells)
  }

  return { header, rows }
}

function isSelectionInsideRange(
  state: EditorState,
  from: number,
  to: number,
): boolean {
  const hasFocus = state.field(editorFocusField, false) ?? false

  for (const range of state.selection.ranges) {
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

class TableWidget extends WidgetType {
  constructor(
    readonly table: ParsedMarkdownTable,
    readonly activateSourceOnClick: boolean,
  ) {
    super()
  }

  eq(other: TableWidget): boolean {
    return (
      JSON.stringify(this.table) === JSON.stringify(other.table)
      && this.activateSourceOnClick === other.activateSourceOnClick
    )
  }

  toDOM(view: EditorView): HTMLElement {
    const root = document.createElement('div')
    root.style.overflowX = 'auto'
    root.style.border = '1px solid var(--border)'
    root.style.borderRadius = '8px'
    root.style.background = 'var(--background)'

    if (this.activateSourceOnClick) {
      root.style.cursor = 'text'
      root.addEventListener('mousedown', (event) => {
        event.preventDefault()
        const blockFrom = view.posAtDOM(root, 0)
        const blockStartLine = view.state.doc.lineAt(blockFrom).number
        let anchor = blockFrom

        const cell = (event.target as HTMLElement).closest('td, th')
        if (cell) {
          const row = cell.parentElement as HTMLTableRowElement
          const section = row.parentElement as HTMLTableSectionElement
          const isHeader = section.tagName === 'THEAD'
          const colIndex = Array.from(row.children).indexOf(cell)

          let sourceLineOffset = 0
          if (isHeader) {
            sourceLineOffset = 0
          }
          else {
            const rowIndex = Array.from(section.children).indexOf(row)
            sourceLineOffset = 2 + rowIndex
          }

          const targetLineNumber = Math.min(
            blockStartLine + sourceLineOffset,
            view.state.doc.lines,
          )
          const lineText = view.state.doc.line(targetLineNumber).text
          const lineFrom = view.state.doc.line(targetLineNumber).from

          let pipeCount = 0
          let colStart = 0
          for (let i = 0; i < lineText.length; i++) {
            if (lineText[i] === '|') {
              pipeCount++
              if (pipeCount === colIndex + 1) {
                colStart = i + 1
                break
              }
            }
          }

          while (colStart < lineText.length && lineText[colStart] === ' ') {
            colStart++
          }

          anchor = Math.min(lineFrom + colStart, view.state.doc.length)
        }

        view.dispatch({
          selection: { anchor },
          effects: setEditorFocusEffect.of(true),
          scrollIntoView: true,
        })
        view.focus()
      })
    }

    const table = document.createElement('table')
    table.style.width = '100%'
    table.style.borderCollapse = 'collapse'
    table.style.fontFamily = 'var(--font-sans)'
    table.style.fontSize = '0.98em'

    const thead = document.createElement('thead')
    const headerRow = document.createElement('tr')

    for (const cellText of this.table.header) {
      const cell = document.createElement('th')
      cell.textContent = cellText
      cell.style.textAlign = 'left'
      cell.style.fontWeight = '600'
      cell.style.color = 'var(--foreground)'
      cell.style.padding = '8px 10px'
      cell.style.borderBottom = '1px solid var(--border)'
      cell.style.background
        = 'color-mix(in oklch, var(--muted) 72%, var(--background))'
      headerRow.append(cell)
    }

    thead.append(headerRow)
    table.append(thead)

    const tbody = document.createElement('tbody')

    for (const row of this.table.rows) {
      const tr = document.createElement('tr')
      for (const cellText of row) {
        const cell = document.createElement('td')
        cell.textContent = cellText
        cell.style.color = 'var(--foreground)'
        cell.style.padding = '7px 10px'
        cell.style.borderBottom = '1px solid var(--border)'
        tr.append(cell)
      }
      tbody.append(tr)
    }

    const lastBodyRow = tbody.lastElementChild as HTMLTableRowElement | null
    if (lastBodyRow) {
      for (const cell of Array.from(lastBodyRow.children)) {
        (cell as HTMLElement).style.borderBottom = 'none'
      }
    }

    table.append(tbody)
    root.append(table)
    return root
  }
}

function buildDecorations(
  state: EditorState,
  enabled: boolean,
  showSourceWhenSelectionInside: boolean,
) {
  if (!enabled)
    return Decoration.none

  const builder = new RangeSetBuilder<Decoration>()

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== 'Table')
        return

      if (
        showSourceWhenSelectionInside
        && isSelectionInsideRange(state, node.from, node.to)
      ) {
        return
      }

      const parsed = parseMarkdownTable(state.sliceDoc(node.from, node.to))
      if (!parsed)
        return

      builder.add(
        node.from,
        node.to,
        Decoration.replace({
          block: true,
          widget: new TableWidget(parsed, showSourceWhenSelectionInside),
        }),
      )
    },
  })

  return builder.finish()
}

export function createTableBlocks(options: TableBlocksOptions = {}) {
  const { enabled = true, showSourceWhenSelectionInside = false } = options

  return StateField.define<DecorationSet>({
    create(state) {
      return buildDecorations(state, enabled, showSourceWhenSelectionInside)
    },
    update(decorations, transaction) {
      const selectionChanged = !transaction.startState.selection.eq(
        transaction.state.selection,
      )

      if (transaction.docChanged || selectionChanged) {
        return buildDecorations(
          transaction.state,
          enabled,
          showSourceWhenSelectionInside,
        )
      }

      return decorations.map(transaction.changes)
    },
    provide: field => EditorView.decorations.from(field),
  })
}

export const tableBlocks = createTableBlocks()
