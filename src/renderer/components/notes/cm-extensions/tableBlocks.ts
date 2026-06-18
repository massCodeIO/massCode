import type { Extension } from '@codemirror/state'
import type { TableModel } from './tableParser'
import { syntaxTree } from '@codemirror/language'
import {
  EditorSelection,
  EditorState,
  Prec,
  RangeSetBuilder,
  StateField,
  Transaction,
} from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  keymap,
  WidgetType,
} from '@codemirror/view'
import {
  moveTableColumn,
  moveTableRow,
  parseDelimiters,
  parseMarkdownTable,
  serializeTable,
  unescapeCell,
} from './tableParser'

interface TableBlocksOptions {
  enabled?: boolean
  // true — таблица рисуется как интерактивный виджет в стиле Obsidian: ячейки
  // правятся прямо в таблице, а боковые зоны позволяют добавлять столбцы/строки.
  // false (режим просмотра) — таблица отрисовывается как блок только для чтения.
  editable?: boolean
}

interface TableRange {
  from: number
  to: number
}

// Ширина зарезервированной зоны у правого/нижнего края, в которой при наведении
// появляются кнопки «добавить столбец» / «добавить строку».
const GUTTER = 16

// Высота тонких полосок над и под таблицей: клик по ним ставит каретку на
// строку до/после таблицы (иначе блок-виджет не оставляет места для клика).
const STRIP = 6

const DRAG_HANDLE_SIZE = 20
const DRAG_COLUMN_HANDLE_WIDTH = 48
const DRAG_COLUMN_HANDLE_INSET = 8
const TABLE_CELL_MIN_WIDTH = 64

type TableDragKind = 'column' | 'row'

function getCellText(cell: Element): string {
  const clone = cell.cloneNode(true) as Element
  clone
    .querySelectorAll('[data-table-drag-handle]')
    .forEach(node => node.remove())
  return clone.textContent ?? ''
}

function setCellText(cell: HTMLTableCellElement, text: string) {
  const handles = Array.from(
    cell.querySelectorAll<HTMLElement>('[data-table-drag-handle]'),
  )
  cell.textContent = text
  cell.append(...handles)
}

function readDelimiters(root: HTMLElement, columns: number): string[] {
  let delimiters: string[] = []
  try {
    delimiters = JSON.parse(root.dataset.tableDelimiters ?? '[]')
  }
  catch {
    delimiters = []
  }

  if (delimiters.length !== columns)
    return Array.from({ length: columns }, () => '---')

  return delimiters
}

// Собирает модель таблицы из «живого» DOM, чтобы захватить несохранённые
// правки в редактируемой ячейке ещё до того, как они записаны в документ.
function readDomModel(root: HTMLElement): TableModel | null {
  const table = root.querySelector('table')
  const head = table?.tHead
  const body = table?.tBodies[0]
  if (!table || !head || !body)
    return null

  const header = Array.from(head.rows[0]?.cells ?? []).map(getCellText)
  const rows = Array.from(body.rows).map(tr =>
    Array.from(tr.cells).map(getCellText),
  )
  const delimiters = readDelimiters(root, header.length)

  return { header, delimiters, rows }
}

// Узел Table из lezer может захватывать завершающие строки без `|` (парсер
// таблицы их пропускает, но блок-декорация перекрыла бы их и спрятала текст, а
// commit — затёр). Поэтому зажимаем конец по последней реальной строке таблицы.
function clampTableEnd(state: EditorState, from: number, to: number): number {
  const text = state.sliceDoc(from, to)
  let offset = 0
  let end = from

  for (const line of text.split('\n')) {
    if (line.includes('|'))
      end = from + offset + line.length
    else break

    offset += line.length + 1
  }

  return end
}

function getTableRangeAt(state: EditorState, pos: number): TableRange | null {
  let result: TableRange | null = null

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== 'Table')
        return

      if (pos >= node.from && pos <= node.to) {
        result = {
          from: node.from,
          to: clampTableEnd(state, node.from, node.to),
        }
      }
    },
  })

  return result
}

function placeCursorAfterTableRange(view: EditorView, range: TableRange) {
  const { doc } = view.state
  const endLine = doc.lineAt(range.to)
  const next = endLine.number < doc.lines ? doc.line(endLine.number + 1) : null

  if (next) {
    view.dispatch({
      selection: { anchor: next.from },
      scrollIntoView: true,
    })
  }
  else {
    view.dispatch({
      changes: { from: range.to, insert: '\n' },
      selection: { anchor: range.to + 1 },
      scrollIntoView: true,
      userEvent: 'input',
    })
  }

  view.focus()
}

function placeCursorBeforeTableRange(view: EditorView, range: TableRange) {
  const { doc } = view.state
  const startLine = doc.lineAt(range.from)
  const prev = startLine.number > 1 ? doc.line(startLine.number - 1) : null

  if (prev) {
    view.dispatch({
      selection: { anchor: prev.to },
      scrollIntoView: true,
    })
  }
  else {
    view.dispatch({
      changes: { from: range.from, insert: '\n' },
      selection: { anchor: range.from },
      scrollIntoView: true,
      userEvent: 'input',
    })
  }

  view.focus()
}

function commitModel(view: EditorView, root: HTMLElement, model: TableModel) {
  const source = serializeTable(model)
  const pos = view.posAtDOM(root, 0)
  const range = getTableRangeAt(view.state, pos)
  if (!range)
    return

  if (view.state.sliceDoc(range.from, range.to) === source)
    return

  view.dispatch({
    changes: { from: range.from, to: range.to, insert: source },
    userEvent: 'input',
  })
}

// updateDOM выполняется внутри цикла обновления CM. Структурная пересборка
// таблицы удаляет сфокусированную ячейку → синхронный blur → commit → dispatch
// во время обновления (запрещено). Флаг гасит такой commit: модель в этот
// момент и так авторитетна, ячейку обратно записывать не нужно.
let reconciling = false

function commitFromDom(view: EditorView, root: HTMLElement) {
  if (reconciling)
    return

  const model = readDomModel(root)
  if (model)
    commitModel(view, root, model)
}

function focusCellEnd(cell: HTMLElement) {
  focusCellAt(cell, cell.textContent?.length ?? 0)
}

function focusCellAt(cell: HTMLElement, offset: number) {
  cell.focus()
  const range = document.createRange()
  const text = cell.firstChild

  if (text?.nodeType === Node.TEXT_NODE) {
    range.setStart(text, Math.min(offset, text.textContent?.length ?? 0))
  }
  else {
    range.selectNodeContents(cell)
    range.collapse(offset <= 0)
  }

  range.collapse(true)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

function selectCellContents(cell: HTMLElement) {
  cell.focus()
  const range = document.createRange()
  range.selectNodeContents(cell)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

function getCellCaretOffset(cell: HTMLElement): number | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed)
    return null

  const range = selection.getRangeAt(0)
  if (!cell.contains(range.startContainer))
    return null

  const before = range.cloneRange()
  before.selectNodeContents(cell)
  before.setEnd(range.startContainer, range.startOffset)

  return before.toString().length
}

function getEditableCells(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'th[contenteditable], td[contenteditable]',
    ),
  )
}

function getCellPosition(
  cell: HTMLElement,
): { row: number, column: number } | null {
  if (!(cell instanceof HTMLTableCellElement))
    return null

  const row = cell.parentElement
  const section = row?.parentElement
  if (!(row instanceof HTMLTableRowElement) || !section)
    return null

  const rowIndex = section.tagName === 'THEAD' ? 0 : row.sectionRowIndex + 1

  return {
    row: rowIndex,
    column: cell.cellIndex,
  }
}

function getLastTableRowIndex(root: HTMLElement): number {
  const bodyRows = root.querySelectorAll('tbody tr').length
  return Math.max(0, bodyRows)
}

function getTableCellAt(
  root: HTMLElement,
  row: number,
  column: number,
): HTMLElement | null {
  if (row === 0)
    return root.querySelectorAll<HTMLElement>('thead th').item(column) || null

  const bodyRow = root
    .querySelectorAll<HTMLTableRowElement>('tbody tr')
    .item(row - 1)

  return bodyRow?.cells.item(column) as HTMLElement | null
}

// После добавления столбца/строки DOM пересобирается из новой модели, поэтому
// фокус в нужную ячейку ставим в микрозадаче — уже по обновлённому DOM.
function focusAfterStructureChange(
  root: HTMLElement,
  selector: string,
  mode: 'end' | 'select' = 'end',
) {
  queueMicrotask(() => {
    const cell = root.querySelector<HTMLElement>(selector)
    if (!cell)
      return

    if (mode === 'select') {
      selectCellContents(cell)
      return
    }

    focusCellEnd(cell)
  })
}

function createPlusIcon(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', '14')
  svg.setAttribute('height', '14')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '2')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.innerHTML = '<path d="M5 12h14"/><path d="M12 5v14"/>'
  return svg
}

function createGripIcon(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', '14')
  svg.setAttribute('height', '14')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('fill', 'currentColor')
  svg.innerHTML = [
    '<circle cx="9" cy="7" r="1.5"/>',
    '<circle cx="15" cy="7" r="1.5"/>',
    '<circle cx="9" cy="12" r="1.5"/>',
    '<circle cx="15" cy="12" r="1.5"/>',
    '<circle cx="9" cy="17" r="1.5"/>',
    '<circle cx="15" cy="17" r="1.5"/>',
  ].join('')
  return svg
}

function clearDragPreview(root: HTMLElement) {
  root
    .querySelectorAll<HTMLElement>('[data-table-drag-preview]')
    .forEach(preview => preview.remove())
}

function clearDragPreviewPart(root: HTMLElement, part: 'selection' | 'target') {
  root
    .querySelectorAll<HTMLElement>(`[data-table-drag-preview="${part}"]`)
    .forEach(preview => preview.remove())
}

function clearFloatingDragHandles(root: HTMLElement) {
  root
    .querySelectorAll<HTMLElement>('[data-table-drag-handle]')
    .forEach(handle => handle.remove())
}

function getTablePartRect(
  root: HTMLElement,
  kind: TableDragKind,
  index: number,
): DOMRect | null {
  if (kind === 'column') {
    const cells = Array.from(
      root.querySelectorAll<HTMLTableCellElement>(
        `tr > :nth-child(${index + 1})`,
      ),
    )
    const first = cells.at(0)
    const last = cells.at(-1)
    if (first && last) {
      const firstRect = first.getBoundingClientRect()
      const lastRect = last.getBoundingClientRect()
      return new DOMRect(
        firstRect.left,
        firstRect.top,
        firstRect.width,
        lastRect.bottom - firstRect.top,
      )
    }

    return null
  }

  const row = root
    .querySelectorAll<HTMLTableRowElement>('tbody tr')
    .item(index)
  return row?.getBoundingClientRect() ?? null
}

function getCurrentDragHandle(root: HTMLElement): HTMLElement | null {
  return root.querySelector<HTMLElement>('[data-table-drag-handle]')
}

function markDragSelection(
  root: HTMLElement,
  kind: TableDragKind,
  index: number,
) {
  clearDragPreviewPart(root, 'selection')

  const rootRect = root.getBoundingClientRect()
  const rect = getTablePartRect(root, kind, index)

  if (!rect)
    return

  const preview = document.createElement('div')
  preview.dataset.tableDragPreview = 'selection'
  preview.style.position = 'absolute'
  preview.style.left = `${rect.left - rootRect.left}px`
  preview.style.top = `${rect.top - rootRect.top}px`
  preview.style.width = `${rect.width}px`
  preview.style.height = `${rect.height}px`
  preview.style.border = '2px solid var(--primary)'
  preview.style.borderRadius = '4px'
  preview.style.background
    = 'color-mix(in oklch, var(--primary) 16%, transparent)'
  preview.style.pointerEvents = 'none'
  preview.style.zIndex = '2'
  root.append(preview)
}

function markDropTarget(root: HTMLElement, kind: TableDragKind, slot: number) {
  clearDragPreviewPart(root, 'target')

  const table = root.querySelector('table')
  if (!table)
    return

  const rootRect = root.getBoundingClientRect()
  const tableRect = table.getBoundingClientRect()
  let position: number | null = null

  if (kind === 'column') {
    const headers = Array.from(
      root.querySelectorAll<HTMLTableCellElement>('th'),
    )
    if (slot < 0 || slot > headers.length)
      return

    if (slot === headers.length) {
      position = tableRect.right
    }
    else {
      position = headers[slot]?.getBoundingClientRect().left ?? null
    }
  }
  else {
    const rows = Array.from(
      root.querySelectorAll<HTMLTableRowElement>('tbody tr'),
    )
    if (slot < 0 || slot > rows.length)
      return

    if (slot === rows.length) {
      position = rows.at(-1)?.getBoundingClientRect().bottom ?? null
    }
    else {
      position = rows[slot]?.getBoundingClientRect().top ?? null
    }
  }

  if (position === null)
    return

  const preview = document.createElement('div')
  preview.dataset.tableDragPreview = 'target'
  preview.style.position = 'absolute'
  preview.style.background = 'var(--primary)'
  preview.style.borderRadius = '999px'
  preview.style.pointerEvents = 'none'
  preview.style.zIndex = '3'

  if (kind === 'column') {
    preview.style.left = `${position - rootRect.left - 1}px`
    preview.style.top = `${tableRect.top - rootRect.top}px`
    preview.style.width = '3px'
    preview.style.height = `${tableRect.height}px`
  }
  else {
    preview.style.left = `${tableRect.left - rootRect.left}px`
    preview.style.top = `${position - rootRect.top - 1}px`
    preview.style.width = `${tableRect.width}px`
    preview.style.height = '3px'
  }

  root.append(preview)
}

function getColumnIndexAt(root: HTMLElement, clientX: number): number | null {
  const headers = Array.from(root.querySelectorAll<HTMLTableCellElement>('th'))
  if (headers.length === 0)
    return null

  for (const [index, cell] of headers.entries()) {
    const rect = cell.getBoundingClientRect()
    if (clientX >= rect.left && clientX <= rect.right)
      return index
  }

  return null
}

function getBodyRowIndexAt(root: HTMLElement, clientY: number): number | null {
  const rows = Array.from(
    root.querySelectorAll<HTMLTableRowElement>('tbody tr'),
  )
  if (rows.length === 0)
    return null

  for (const [index, row] of rows.entries()) {
    const rect = row.getBoundingClientRect()
    if (clientY >= rect.top && clientY <= rect.bottom)
      return index
  }

  return null
}

function getDropSlot(from: number, hovered: number): number | null {
  if (hovered === from)
    return null

  return hovered > from ? hovered + 1 : hovered
}

function getMovedIndex(from: number, toSlot: number): number {
  return toSlot > from ? toSlot - 1 : toSlot
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function clampColumnHandleCenter(tableRect: DOMRect, centerX: number): number {
  const half = DRAG_COLUMN_HANDLE_WIDTH / 2
  const min = tableRect.left + half + DRAG_COLUMN_HANDLE_INSET
  const max = tableRect.right - half - DRAG_COLUMN_HANDLE_INSET

  if (max < min)
    return tableRect.left + tableRect.width / 2

  return clamp(centerX, min, max)
}

function getColumnHoverTarget(
  root: HTMLElement,
  clientX: number,
  clientY: number,
): { cell: HTMLTableCellElement, index: number } | null {
  const table = root.querySelector('table')
  if (!table)
    return null

  const tableRect = table.getBoundingClientRect()
  if (clientY < tableRect.top - DRAG_HANDLE_SIZE || clientY > tableRect.top) {
    return null
  }

  const headers = Array.from(root.querySelectorAll<HTMLTableCellElement>('th'))
  for (const [index, cell] of headers.entries()) {
    const rect = cell.getBoundingClientRect()
    if (clientX >= rect.left && clientX <= rect.right)
      return { cell, index }
  }

  return null
}

function getRowHoverTarget(
  root: HTMLElement,
  clientX: number,
  clientY: number,
): { cell: HTMLTableCellElement, index: number } | null {
  const table = root.querySelector('table')
  if (!table)
    return null

  const tableRect = table.getBoundingClientRect()
  if (
    clientX < tableRect.left - DRAG_HANDLE_SIZE
    || clientX > tableRect.left + GUTTER
  ) {
    return null
  }

  const rows = Array.from(
    root.querySelectorAll<HTMLTableRowElement>('tbody tr'),
  )
  for (const [index, row] of rows.entries()) {
    const rect = row.getBoundingClientRect()
    if (clientY >= rect.top && clientY <= rect.bottom) {
      const cell = row.cells.item(0)
      return cell ? { cell, index } : null
    }
  }

  return null
}

// Блочный виджет, заменяющий исходный markdown таблицы её отрисовкой. В
// редактируемом режиме ячейки — contenteditable, а правки коммитятся в документ
// по blur/Enter/Tab (а не на каждое нажатие), чтобы CodeMirror не перетягивал
// каретку из ячейки при пересборке декораций.
class TableWidget extends WidgetType {
  constructor(
    readonly model: TableModel,
    readonly source: string,
    // Имя `editable` занято геттером WidgetType, поэтому `interactive`.
    readonly interactive: boolean,
  ) {
    super()
  }

  eq(other: TableWidget): boolean {
    return (
      this.source === other.source && this.interactive === other.interactive
    )
  }

  // Перехватываем, чтобы клавиши не уходили в keymap редактора (отступ по Tab,
  // перенос строки по Enter и т.п.).
  private onCellKeydown(
    event: KeyboardEvent,
    view: EditorView,
    root: HTMLElement,
  ) {
    const cell = event.currentTarget as HTMLElement

    if (this.onCellArrowKeydown(event, view, root, cell))
      return

    if (event.key === 'Enter' || event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      cell.blur()
      return
    }

    if (event.key === 'Tab') {
      event.preventDefault()
      event.stopPropagation()
      const cells = getEditableCells(root)
      const index = cells.indexOf(cell)
      const next = cells[index + (event.shiftKey ? -1 : 1)]
      if (next) {
        commitFromDom(view, root)
        selectCellContents(next)
      }
      else if (!event.shiftKey) {
        this.addRow(view, root, 'select')
      }
      else {
        commitFromDom(view, root)
        this.placeCursorAdjacent(view, root, true)
      }
    }
  }

  private onCellArrowKeydown(
    event: KeyboardEvent,
    view: EditorView,
    root: HTMLElement,
    cell: HTMLElement,
  ): boolean {
    if (
      event.key !== 'ArrowUp'
      && event.key !== 'ArrowDown'
      && event.key !== 'ArrowLeft'
      && event.key !== 'ArrowRight'
    ) {
      return false
    }

    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
      return false

    const position = getCellPosition(cell)
    const offset = getCellCaretOffset(cell)
    if (!position || offset === null)
      return false

    let target: HTMLElement | null = null
    let targetOffset = offset

    if (event.key === 'ArrowUp') {
      if (position.row === 0) {
        event.preventDefault()
        event.stopPropagation()
        commitFromDom(view, root)
        this.placeCursorAdjacent(view, root, true)
        return true
      }

      target = getTableCellAt(root, position.row - 1, position.column)
    }
    else if (event.key === 'ArrowDown') {
      if (position.row >= getLastTableRowIndex(root)) {
        event.preventDefault()
        event.stopPropagation()
        commitFromDom(view, root)
        this.placeCursorAdjacent(view, root, false)
        return true
      }

      target = getTableCellAt(root, position.row + 1, position.column)
    }
    else if (event.key === 'ArrowLeft') {
      if (offset > 0)
        return false

      target = getTableCellAt(root, position.row, position.column - 1)
      targetOffset = target?.textContent?.length ?? 0
    }
    else {
      if (offset < (cell.textContent?.length ?? 0))
        return false

      target = getTableCellAt(root, position.row, position.column + 1)
      targetOffset = 0
    }

    if (!target)
      return false

    event.preventDefault()
    event.stopPropagation()
    commitFromDom(view, root)
    focusCellAt(target, targetOffset)

    return true
  }

  // Только простой текст без переносов — иначе ячейка ломает markdown-таблицу.
  private onCellPaste(event: ClipboardEvent) {
    event.preventDefault()
    const text = (event.clipboardData?.getData('text/plain') ?? '').replace(
      /[\r\n]+/g,
      ' ',
    )
    document.execCommand('insertText', false, text)
  }

  private moveColumn(
    view: EditorView,
    root: HTMLElement,
    from: number,
    to: number,
  ) {
    const model = readDomModel(root)
    if (!model)
      return

    const active = document.activeElement
    if (active instanceof HTMLElement && root.contains(active))
      active.blur()

    commitModel(view, root, moveTableColumn(model, from, to))
    focusAfterStructureChange(
      root,
      `thead th:nth-child(${getMovedIndex(from, to) + 1})`,
    )
  }

  private moveRow(
    view: EditorView,
    root: HTMLElement,
    from: number,
    to: number,
  ) {
    const model = readDomModel(root)
    if (!model)
      return

    const active = document.activeElement
    if (active instanceof HTMLElement && root.contains(active))
      active.blur()

    commitModel(view, root, moveTableRow(model, from, to))
    focusAfterStructureChange(
      root,
      `tbody tr:nth-child(${getMovedIndex(from, to) + 1}) td:first-child`,
    )
  }

  private startDrag(
    event: PointerEvent,
    view: EditorView,
    root: HTMLElement,
    kind: TableDragKind,
    from: number,
  ) {
    event.preventDefault()
    event.stopPropagation()

    const handle = event.currentTarget
    if (handle instanceof HTMLElement)
      handle.style.cursor = 'grabbing'

    root.dataset.tableDragging = '1'
    let targetSlot: number | null = null
    markDragSelection(root, kind, from)

    const move = (moveEvent: PointerEvent) => {
      const next
        = kind === 'column'
          ? getColumnIndexAt(root, moveEvent.clientX)
          : getBodyRowIndexAt(root, moveEvent.clientY)

      const handle = getCurrentDragHandle(root)
      if (handle) {
        this.positionDragHandleAtPointer(root, handle, kind, moveEvent)
      }

      if (next === null)
        return

      const nextSlot = getDropSlot(from, next)
      if (nextSlot === targetSlot)
        return

      if (nextSlot === null) {
        targetSlot = null
        clearDragPreviewPart(root, 'target')
        return
      }

      targetSlot = nextSlot
      markDropTarget(root, kind, targetSlot)
    }

    const stop = () => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', stop)
      document.removeEventListener('pointercancel', stop)
      delete root.dataset.tableDragging
      clearDragPreview(root)
      clearFloatingDragHandles(root)

      if (targetSlot === null)
        return

      if (kind === 'column') {
        this.moveColumn(view, root, from, targetSlot)
      }
      else {
        this.moveRow(view, root, from, targetSlot)
      }
    }

    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', stop)
    document.addEventListener('pointercancel', stop)
  }

  private createDragHandle(
    view: EditorView,
    root: HTMLElement,
    kind: TableDragKind,
    index: number,
  ): HTMLElement {
    const handle = document.createElement('span')
    handle.dataset.tableDragHandle = kind
    handle.contentEditable = 'false'
    handle.draggable = false
    handle.style.position = 'absolute'
    handle.style.zIndex = '3'
    handle.style.display = 'flex'
    handle.style.alignItems = 'center'
    handle.style.justifyContent = 'center'
    handle.style.width
      = kind === 'column'
        ? `${DRAG_COLUMN_HANDLE_WIDTH}px`
        : `${DRAG_HANDLE_SIZE}px`
    handle.style.height = `${DRAG_HANDLE_SIZE}px`
    handle.style.borderRadius = kind === 'column' ? '5px 5px 0 0' : '5px'
    handle.style.background = 'var(--primary)'
    handle.style.color = 'var(--primary-foreground)'
    handle.style.cursor = 'grab'
    handle.style.opacity = '0.96'
    handle.style.userSelect = 'none'

    handle.append(createGripIcon())
    handle.addEventListener('pointerdown', (event) => {
      this.startDrag(event, view, root, kind, index)
    })

    return handle
  }

  private positionDragHandle(
    root: HTMLElement,
    cell: HTMLTableCellElement,
    handle: HTMLElement,
    kind: TableDragKind,
  ) {
    const rootRect = root.getBoundingClientRect()
    const cellRect = cell.getBoundingClientRect()

    if (kind === 'column') {
      const tableRect = cell.closest('table')?.getBoundingClientRect()
      const centerX = cellRect.left + cellRect.width / 2
      const clampedCenterX = tableRect
        ? clampColumnHandleCenter(tableRect, centerX)
        : centerX
      handle.style.left = `${clampedCenterX - rootRect.left - DRAG_COLUMN_HANDLE_WIDTH / 2}px`
      handle.style.top = `${cellRect.top - rootRect.top - DRAG_HANDLE_SIZE}px`
      return
    }

    handle.style.left = `${cellRect.left - rootRect.left - DRAG_HANDLE_SIZE / 2}px`
    handle.style.top = `${cellRect.top - rootRect.top + cellRect.height / 2 - DRAG_HANDLE_SIZE / 2}px`
  }

  private positionDragHandleAtPointer(
    root: HTMLElement,
    handle: HTMLElement,
    kind: TableDragKind,
    event: PointerEvent,
  ) {
    const table = root.querySelector('table')
    if (!table)
      return

    const rootRect = root.getBoundingClientRect()
    const tableRect = table.getBoundingClientRect()

    if (kind === 'column') {
      const centerX = clampColumnHandleCenter(tableRect, event.clientX)
      handle.style.left = `${centerX - rootRect.left - DRAG_COLUMN_HANDLE_WIDTH / 2}px`
      handle.style.top = `${tableRect.top - rootRect.top - DRAG_HANDLE_SIZE}px`
      return
    }

    const body = table.tBodies[0]
    const bodyRect = body?.getBoundingClientRect() ?? tableRect
    const centerY = clamp(event.clientY, bodyRect.top, bodyRect.bottom)
    handle.style.left = `${tableRect.left - rootRect.left - DRAG_HANDLE_SIZE / 2}px`
    handle.style.top = `${centerY - rootRect.top - DRAG_HANDLE_SIZE / 2}px`
  }

  private showDragHandle(
    root: HTMLElement,
    view: EditorView,
    kind: TableDragKind,
    index: number,
    cell: HTMLTableCellElement,
  ) {
    if (
      root.dataset.tableDragKind === kind
      && root.dataset.tableDragIndex === String(index)
    ) {
      return
    }

    clearFloatingDragHandles(root)
    root.dataset.tableDragKind = kind
    root.dataset.tableDragIndex = String(index)

    const handle = this.createDragHandle(view, root, kind, index)
    this.positionDragHandle(root, cell, handle, kind)
    root.append(handle)
    markDragSelection(root, kind, index)
  }

  private clearHoverDragState(root: HTMLElement) {
    delete root.dataset.tableDragKind
    delete root.dataset.tableDragIndex
    clearFloatingDragHandles(root)
    clearDragPreview(root)
  }

  private onRootPointerMove(
    event: PointerEvent,
    view: EditorView,
    root: HTMLElement,
  ) {
    if (root.dataset.tableDragging === '1')
      return

    const column = getColumnHoverTarget(root, event.clientX, event.clientY)
    if (column) {
      this.showDragHandle(root, view, 'column', column.index, column.cell)
      return
    }

    const row = getRowHoverTarget(root, event.clientX, event.clientY)
    if (row) {
      this.showDragHandle(root, view, 'row', row.index, row.cell)
      return
    }

    const target = event.target
    if (
      target instanceof HTMLElement
      && target.closest('[data-table-drag-handle]')
    ) {
      return
    }

    this.clearHoverDragState(root)
  }

  private onRootPointerLeave(root: HTMLElement, event: PointerEvent) {
    if (root.dataset.tableDragging === '1')
      return

    const related = event.relatedTarget
    if (
      related instanceof HTMLElement
      && related.closest('[data-table-drag-handle]')
    ) {
      return
    }

    this.clearHoverDragState(root)
  }

  private attachDragHover(view: EditorView, root: HTMLElement) {
    root.addEventListener('pointermove', event =>
      this.onRootPointerMove(event, view, root))
    root.addEventListener('pointerleave', event =>
      this.onRootPointerLeave(root, event))
  }

  private createCell(
    tag: 'th' | 'td',
    text: string,
    view: EditorView,
    root: HTMLElement,
  ): HTMLTableCellElement {
    const cell = document.createElement(tag)
    cell.textContent = unescapeCell(text)
    cell.style.position = 'relative'
    cell.style.minWidth = `${TABLE_CELL_MIN_WIDTH}px`
    cell.style.textAlign = 'left'
    cell.style.color = 'var(--foreground)'
    cell.style.padding = tag === 'th' ? '8px 10px' : '7px 10px'
    cell.style.borderBottom = '1px solid var(--border)'

    if (tag === 'th') {
      cell.style.fontWeight = '600'
      cell.style.background
        = 'color-mix(in oklch, var(--muted) 72%, var(--background))'
    }

    if (this.interactive) {
      cell.contentEditable = 'true'
      cell.spellcheck = false
      cell.style.outline = 'none'
      cell.addEventListener('keydown', e =>
        this.onCellKeydown(e, view, root))
      cell.addEventListener('paste', e => this.onCellPaste(e))
      cell.addEventListener('blur', () => commitFromDom(view, root))
    }

    return cell
  }

  private buildTable(view: EditorView, root: HTMLElement): HTMLTableElement {
    const table = document.createElement('table')
    table.style.width = 'max-content'
    table.style.minWidth = 'max-content'
    table.style.borderCollapse = 'collapse'
    table.style.fontFamily = 'var(--font-sans)'
    table.style.fontSize = '0.98em'

    const thead = document.createElement('thead')
    const headerRow = document.createElement('tr')
    for (const text of this.model.header)
      headerRow.append(this.createCell('th', text, view, root))

    thead.append(headerRow)
    table.append(thead)

    const tbody = document.createElement('tbody')
    for (const row of this.model.rows) {
      const tr = document.createElement('tr')
      for (const text of row)
        tr.append(this.createCell('td', text, view, root))

      tbody.append(tr)
    }
    table.append(tbody)

    const lastRow = tbody.lastElementChild as HTMLTableRowElement | null
    if (lastRow) {
      for (const cell of Array.from(lastRow.children))
        (cell as HTMLElement).style.borderBottom = 'none'
    }

    return table
  }

  private addColumn(view: EditorView, root: HTMLElement) {
    const model = readDomModel(root)
    if (!model)
      return

    model.header.push('')
    model.delimiters.push('---')
    for (const row of model.rows) row.push('')

    commitModel(view, root, model)
    focusAfterStructureChange(root, 'thead th:last-child')
  }

  private addRow(
    view: EditorView,
    root: HTMLElement,
    focusMode: 'end' | 'select' = 'end',
  ) {
    const model = readDomModel(root)
    if (!model)
      return

    model.rows.push(Array.from({ length: model.header.length }, () => ''))

    commitModel(view, root, model)
    focusAfterStructureChange(
      root,
      'tbody tr:last-child td:first-child',
      focusMode,
    )
  }

  // Ставит каретку на строку до/после таблицы. Если такой строки нет (таблица в
  // начале/конце документа), вставляет пустую — чтобы было куда печатать, не
  // ломая markdown таблицы.
  private placeCursorAdjacent(
    view: EditorView,
    root: HTMLElement,
    before: boolean,
  ) {
    const pos = view.posAtDOM(root, 0)
    const range = getTableRangeAt(view.state, pos)
    if (!range)
      return

    if (before) {
      placeCursorBeforeTableRange(view, range)
    }
    else {
      placeCursorAfterTableRange(view, range)
    }
  }

  private createGutter(
    orientation: 'column' | 'row',
    onActivate: () => void,
  ): HTMLElement {
    const gutter = document.createElement('div')
    gutter.dataset.tableGutter = orientation
    gutter.style.position = 'absolute'
    gutter.style.display = 'flex'
    gutter.style.alignItems = 'center'
    gutter.style.justifyContent = 'center'
    gutter.style.cursor = 'pointer'
    gutter.style.opacity = '0'
    gutter.style.transition = 'opacity 0.12s ease, background 0.12s ease'
    gutter.style.color = 'var(--muted-foreground)'
    gutter.style.borderRadius = '6px'

    if (orientation === 'column') {
      gutter.style.top = `${DRAG_HANDLE_SIZE}px`
      gutter.style.right = '0'
      gutter.style.width = `${GUTTER}px`
      gutter.style.bottom = `${GUTTER + STRIP}px`
    }
    else {
      gutter.style.left = '0'
      gutter.style.bottom = `${STRIP}px`
      gutter.style.height = `${GUTTER}px`
      gutter.style.right = `${GUTTER}px`
    }

    gutter.append(createPlusIcon())

    gutter.addEventListener('mouseenter', () => {
      gutter.style.opacity = '1'
      gutter.style.background
        = 'color-mix(in oklch, var(--accent) 60%, transparent)'
      gutter.style.color = 'var(--foreground)'
    })
    gutter.addEventListener('mouseleave', () => {
      gutter.style.opacity = '0'
      gutter.style.background = 'transparent'
      gutter.style.color = 'var(--muted-foreground)'
    })
    gutter.addEventListener('mousedown', (event) => {
      // preventDefault сохраняет фокус в текущей ячейке — несохранённая правка
      // не теряется, так как модель читается прямо из DOM.
      event.preventDefault()
      event.stopPropagation()
      onActivate()
    })

    return gutter
  }

  private createRowDragHoverZone(): HTMLElement {
    const zone = document.createElement('div')
    zone.dataset.tableDragZone = 'row'
    zone.style.position = 'absolute'
    zone.style.left = `-${DRAG_HANDLE_SIZE}px`
    zone.style.top = `${DRAG_HANDLE_SIZE}px`
    zone.style.bottom = `${GUTTER + STRIP}px`
    zone.style.width = `${DRAG_HANDLE_SIZE}px`
    zone.style.pointerEvents = 'auto'
    zone.style.background = 'transparent'
    zone.style.zIndex = '1'

    return zone
  }

  toDOM(view: EditorView): HTMLElement {
    const root = document.createElement('div')
    root.dataset.tableWidget = '1'
    root.dataset.editable = this.interactive ? '1' : '0'
    root.dataset.tableDelimiters = JSON.stringify(this.model.delimiters)
    root.contentEditable = 'false'
    root.style.position = 'relative'
    root.style.width = 'fit-content'
    root.style.maxWidth = '100%'

    const scroll = document.createElement('div')
    scroll.style.display = 'inline-block'
    scroll.style.maxWidth = '100%'
    scroll.style.verticalAlign = 'top'
    scroll.style.overflowX = 'auto'
    scroll.style.border = '1px solid var(--border)'
    scroll.style.borderRadius = '8px'
    scroll.style.background = 'var(--background)'

    if (this.interactive) {
      root.style.paddingTop = `${DRAG_HANDLE_SIZE}px`
      root.style.paddingRight = `${GUTTER}px`
      root.style.paddingBottom = `${GUTTER + STRIP}px`
    }

    scroll.append(this.buildTable(view, root))
    root.append(scroll)

    if (this.interactive) {
      // Клик мимо ячеек и gutter'ов (по полоскам сверху/снизу) ставит каретку
      // до или после таблицы — это единственный способ начать писать рядом с
      // блок-виджетом, который иначе занимает всю строку.
      root.addEventListener('mousedown', (event) => {
        const target = event.target as HTMLElement
        if (
          target.closest('th, td')
          || target.closest('[data-table-gutter]')
          || target.closest('[data-table-drag-handle]')
          || target.closest('[data-table-drag-zone]')
        ) {
          return
        }

        event.preventDefault()
        const rect = scroll.getBoundingClientRect()
        const before = event.clientY < rect.top + rect.height / 2
        this.placeCursorAdjacent(view, root, before)
      })
      this.attachDragHover(view, root)

      root.append(
        this.createRowDragHoverZone(),
        this.createGutter('column', () => this.addColumn(view, root)),
        this.createGutter('row', () => this.addRow(view, root)),
      )
    }

    return root
  }

  // Обновляем уже отрисованный DOM на месте, чтобы синхронизация с документом
  // не пересоздавала таблицу и не уводила фокус из редактируемой ячейки.
  updateDOM(dom: HTMLElement, view: EditorView): boolean {
    if (dom.dataset.tableWidget !== '1')
      return false
    if ((dom.dataset.editable === '1') !== this.interactive)
      return false

    const table = dom.querySelector('table')
    const head = table?.tHead
    const body = table?.tBodies[0]
    if (!table || !head || !body)
      return false

    dom.dataset.tableDelimiters = JSON.stringify(this.model.delimiters)

    reconciling = true
    try {
      this.reconcile(view, dom, table, head, body)
    }
    finally {
      reconciling = false
    }

    return true
  }

  private reconcile(
    view: EditorView,
    dom: HTMLElement,
    table: HTMLTableElement,
    head: HTMLTableSectionElement,
    body: HTMLTableSectionElement,
  ) {
    const sameShape
      = (head.rows[0]?.cells.length ?? 0) === this.model.header.length
        && body.rows.length === this.model.rows.length

    if (!sameShape) {
      table.replaceWith(this.buildTable(view, dom))
      return
    }

    const active = document.activeElement
    const apply = (cell: HTMLTableCellElement | undefined, text: string) => {
      if (!cell || cell === active)
        return
      const display = unescapeCell(text)
      if (getCellText(cell) !== display)
        setCellText(cell, display)
    }

    this.model.header.forEach((text, col) =>
      apply(head.rows[0]?.cells[col], text),
    )
    this.model.rows.forEach((row, ri) =>
      row.forEach((text, col) => apply(body.rows[ri]?.cells[col], text)),
    )
  }

  ignoreEvent(): boolean {
    return true
  }
}

function getNearestTableWidgetAbove(
  view: EditorView,
  clientY: number,
): HTMLElement | null {
  let result: HTMLElement | null = null
  let resultBottom = -Infinity

  for (const widget of Array.from(
    view.dom.querySelectorAll<HTMLElement>('[data-table-widget="1"]'),
  )) {
    const rect = widget.getBoundingClientRect()
    if (clientY < rect.bottom || rect.bottom <= resultBottom)
      continue

    result = widget
    resultBottom = rect.bottom
  }

  return result
}

function maybePlaceCursorAfterTableClick(
  view: EditorView,
  event: MouseEvent,
): boolean {
  if (event.button !== 0)
    return false

  const target = event.target
  if (!(target instanceof HTMLElement))
    return false
  if (target.closest('[data-table-widget="1"]'))
    return false

  const widget = getNearestTableWidgetAbove(view, event.clientY)
  if (!widget)
    return false

  const tablePos = view.posAtDOM(widget, 0)
  const range = getTableRangeAt(view.state, tablePos)
  if (!range)
    return false

  const clickPos
    = view.posAtCoords({ x: event.clientX, y: event.clientY }, false)
      ?? view.state.doc.length

  if (clickPos < range.to)
    return false

  if (view.state.sliceDoc(range.to, clickPos).trim() !== '')
    return false

  event.preventDefault()
  event.stopPropagation()
  placeCursorAfterTableRange(view, range)

  return true
}

function findTableRangeStartingAt(
  state: EditorState,
  pos: number,
): TableRange | null {
  let result: TableRange | null = null

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== 'Table' || node.from !== pos)
        return

      result = {
        from: node.from,
        to: clampTableEnd(state, node.from, node.to),
      }
    },
  })

  return result
}

export function isProtectedTableBoundaryLine(state: EditorState): boolean {
  if (!state.selection.main.empty)
    return false

  const head = state.selection.main.head
  const line = state.doc.lineAt(head)

  return isProtectedTableBoundary(state, line.number)
}

function isProtectedTableBoundary(
  state: EditorState,
  lineNumber: number,
): boolean {
  if (lineNumber < 1 || lineNumber >= state.doc.lines)
    return false

  const line = state.doc.line(lineNumber)
  if (line.text.trim() !== '')
    return false

  const nextLine = state.doc.line(lineNumber + 1)
  return findTableRangeStartingAt(state, nextLine.from) !== null
}

export function isProtectedTableBoundaryDeletePosition(
  state: EditorState,
): boolean {
  if (!state.selection.main.empty)
    return false

  const head = state.selection.main.head
  const line = state.doc.lineAt(head)

  if (isProtectedTableBoundary(state, line.number))
    return true

  if (head !== line.to || line.number >= state.doc.lines)
    return false

  return isProtectedTableBoundary(state, line.number + 1)
}

function moveBeforeProtectedTableBoundary(view: EditorView): boolean {
  if (!isProtectedTableBoundaryLine(view.state))
    return false

  const line = view.state.doc.lineAt(view.state.selection.main.head)
  if (line.number > 1) {
    const prev = view.state.doc.line(line.number - 1)
    view.dispatch({
      selection: { anchor: prev.to },
      scrollIntoView: true,
    })
  }

  view.focus()
  return true
}

function preventProtectedTableBoundaryDelete(view: EditorView): boolean {
  return isProtectedTableBoundaryDeletePosition(view.state)
}

function preserveTableBoundaryOnInput(transaction: Transaction) {
  if (!transaction.docChanged || !transaction.isUserEvent('input.type'))
    return transaction

  let input: {
    from: number
    text: string
  } | null = null

  transaction.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    if (input || fromA !== toA)
      return

    const text = inserted.toString()
    if (!text || text.includes('\n'))
      return

    input = { from: fromA, text }
  })

  if (!input)
    return transaction

  const line = transaction.startState.doc.lineAt(input.from)
  if (
    input.from !== line.from
    || !isProtectedTableBoundary(transaction.startState, line.number)
  ) {
    return transaction
  }

  return {
    changes: {
      from: line.from,
      insert: `${input.text}\n`,
    },
    selection: EditorSelection.cursor(line.from + input.text.length),
    scrollIntoView: transaction.scrollIntoView,
    userEvent: transaction.annotation(Transaction.userEvent) ?? 'input.type',
  }
}

function buildDecorations(
  state: EditorState,
  enabled: boolean,
  editable: boolean,
): DecorationSet {
  if (!enabled)
    return Decoration.none

  const builder = new RangeSetBuilder<Decoration>()

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== 'Table')
        return

      const to = clampTableEnd(state, node.from, node.to)
      const source = state.sliceDoc(node.from, to)
      const parsed = parseMarkdownTable(source)
      if (!parsed)
        return

      const model: TableModel = {
        header: parsed.header,
        rows: parsed.rows,
        delimiters: parseDelimiters(source, parsed.header.length),
      }

      builder.add(
        node.from,
        to,
        Decoration.replace({
          block: true,
          widget: new TableWidget(model, source, editable),
        }),
      )
    },
  })

  return builder.finish()
}

export function createTableBlocks(options: TableBlocksOptions = {}): Extension {
  const { enabled = true, editable = false } = options

  const decorations = StateField.define<DecorationSet>({
    create(state) {
      return buildDecorations(state, enabled, editable)
    },
    update(value, transaction) {
      // Дерево разбора может достроиться асинхронно (без изменения документа),
      // поэтому сравниваем идентичность деревьев, чтобы подхватить такие блоки.
      const treeChanged
        = syntaxTree(transaction.startState) !== syntaxTree(transaction.state)

      if (transaction.docChanged || treeChanged)
        return buildDecorations(transaction.state, enabled, editable)

      return value
    },
    provide: field => EditorView.decorations.from(field),
  })

  if (!editable)
    return decorations

  return [
    decorations,
    EditorState.transactionFilter.of(preserveTableBoundaryOnInput),
    Prec.highest(
      keymap.of([
        {
          key: 'Backspace',
          run: moveBeforeProtectedTableBoundary,
        },
        {
          key: 'Delete',
          run: preventProtectedTableBoundaryDelete,
        },
      ]),
    ),
    EditorView.domEventHandlers({
      mousedown(event, view) {
        return maybePlaceCursorAfterTableClick(view, event)
      },
    }),
  ]
}

export const tableBlocks = createTableBlocks()
