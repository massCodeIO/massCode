import type { Extension } from '@codemirror/state'
import type { TableColumnAlignment, TableModel } from './tableParser'
import { redo, undo } from '@codemirror/commands'
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
import { freezeRevealSelectionUntilMouseup } from './revealSelection'
import {
  type CellSelectionTarget,
  createTableCellEditor,
} from './tableCellEditor'
import { renderCellMarkdown } from './tableCellMarkdown'
import {
  delimiterAlignment,
  escapeCell,
  insertTableColumn,
  insertTableRow,
  moveTableColumn,
  moveTableRow,
  parseDelimiters,
  parseMarkdownTable,
  removeTableColumn,
  removeTableRow,
  serializeTable,
  setTableColumnAlignment,
  unescapeCell,
} from './tableParser'

interface TableBlocksOptions {
  enabled?: boolean
  // true — таблица рисуется как интерактивный виджет в стиле Obsidian: ячейки
  // правятся прямо в таблице, а боковые зоны позволяют добавлять столбцы/строки.
  // false (режим просмотра) — таблица отрисовывается как блок только для чтения.
  editable?: boolean
  // Тема подсветки кода для вложенных редакторов ячеек.
  isDark?: boolean
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

// Активный вложенный редактор ячейки. Он всегда один на всё приложение
// (фокус один), поэтому храним единственную запись, а не карту по виджетам.
// Привязка к DOM, а не к инстансу TableWidget: инстансы пересоздаются при
// каждом коммите, а DOM переживает их.
interface ActiveCellEditor {
  view: EditorView
  root: HTMLElement
  cell: HTMLTableCellElement
  editor: EditorView
}

let activeCell: ActiveCellEditor | null = null

// Редактор активной ячейки — для маршрутизации команд контекстного меню.
export function getActiveTableCellEditor(): EditorView | null {
  return activeCell?.editor ?? null
}

function getActiveCellFor(root: HTMLElement): ActiveCellEditor | null {
  return activeCell?.root === root ? activeCell : null
}

// Сырой markdown ячейки: активная ячейка — из её редактора, остальные — из
// dataset.raw (в DOM у них отрисованный текст со скрытыми маркерами).
function getCellText(cell: Element): string {
  if (activeCell?.cell === cell)
    return activeCell.editor.state.doc.toString()

  const element = cell as HTMLElement
  return element.dataset?.raw ?? element.textContent ?? ''
}

// Отрисовывает ячейку из сырого markdown (спокойное состояние).
function renderCell(cell: HTMLTableCellElement, raw: string) {
  cell.replaceChildren(renderCellMarkdown(raw))

  // Пустой ячейке нужен строчный бокс, иначе строка схлопнется по высоте.
  if (raw.trim() === '')
    cell.append(document.createElement('br'))

  cell.dataset.raw = raw
}

function setCellText(cell: HTMLTableCellElement, text: string) {
  renderCell(cell, text)
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

// Коммит уже идёт: dispatch внутри dispatch запрещён, а попутные события
// (например, blur при переносе фокуса) не должны запускать вложенный коммит.
let committing = false

// Записывает модель таблицы в документ минимальным diff'ом (общие префикс и
// суффикс не трогаются): так история CodeMirror склеивает посимвольный набор
// в обычные undo-шаги, как при печати в тексте. Возвращает диапазон таблицы
// после записи или null, если таблицу не удалось найти.
function commitModel(
  view: EditorView,
  root: HTMLElement,
  model: TableModel,
  userEvent = 'input',
): TableRange | null {
  const source = serializeTable(model)
  let pos: number
  try {
    pos = view.posAtDOM(root, 0)
  }
  catch {
    // Виджет мог быть отсоединён от документа между событием и коммитом.
    return null
  }

  const range = getTableRangeAt(view.state, pos)
  if (!range)
    return null

  const current = view.state.sliceDoc(range.from, range.to)
  if (current === source)
    return range

  let start = 0
  while (
    start < current.length
    && start < source.length
    && current[start] === source[start]
  ) {
    start += 1
  }

  let currentEnd = current.length
  let sourceEnd = source.length
  while (
    currentEnd > start
    && sourceEnd > start
    && current[currentEnd - 1] === source[sourceEnd - 1]
  ) {
    currentEnd -= 1
    sourceEnd -= 1
  }

  committing = true
  try {
    view.dispatch({
      changes: {
        from: range.from + start,
        to: range.from + currentEnd,
        insert: source.slice(start, sourceEnd),
      },
      userEvent,
    })
  }
  finally {
    committing = false
  }

  return { from: range.from, to: range.from + source.length }
}

function commitFromDom(
  view: EditorView,
  root: HTMLElement,
  userEvent?: string,
) {
  if (committing)
    return

  const model = readDomModel(root)
  if (model)
    commitModel(view, root, model, userEvent)
}

// ---- Вложенный редактор активной ячейки ------------------------------------

function resolveCellSelection(
  editor: EditorView,
  target: CellSelectionTarget,
): EditorSelection {
  const length = editor.state.doc.length

  if (target === 'start')
    return EditorSelection.single(0)
  if (target === 'end')
    return EditorSelection.single(length)
  if (target === 'all')
    return EditorSelection.single(0, length)
  if ('offset' in target)
    return EditorSelection.single(Math.min(target.offset, length))

  // Неточный режим posAtCoords: всегда возвращает ближайшую позицию, даже
  // если геометрия ещё не измерена после монтирования.
  if ('coords' in target)
    return EditorSelection.single(editor.posAtCoords(target.coords, false))

  const rect = editor.contentDOM.getBoundingClientRect()
  const y = target.edge === 'top' ? rect.top + 1 : rect.bottom - 1
  return EditorSelection.single(editor.posAtCoords({ x: target.x, y }, false))
}

// Демонтирует активный редактор и возвращает ячейке отрисованный вид.
function deactivateCellEditor(view: EditorView, root: HTMLElement) {
  const active = getActiveCellFor(root)
  if (!active)
    return

  const text = active.editor.state.doc.toString()
  activeCell = null
  active.editor.destroy()
  renderCell(active.cell, text)
  // Текст уже закоммичен по onChange; это страховка от пропущенных событий.
  commitFromDom(view, root)
}

// Демонтирует редактор без коммита и рендера — для случаев, когда DOM ячейки
// сейчас будет уничтожен (структурная пересборка, destroy виджета).
function disposeCellEditor(root: HTMLElement) {
  const active = getActiveCellFor(root)
  if (!active)
    return

  activeCell = null
  active.editor.destroy()
}

function activateCellEditor(
  view: EditorView,
  root: HTMLElement,
  cell: HTMLTableCellElement,
  target: CellSelectionTarget,
) {
  if (activeCell?.cell === cell) {
    activeCell.editor.focus()
    activeCell.editor.dispatch({
      selection: resolveCellSelection(activeCell.editor, target),
    })
    return
  }

  if (activeCell)
    deactivateCellEditor(activeCell.view, activeCell.root)

  const text = cell.dataset.raw ?? ''
  cell.replaceChildren()

  const editor = createTableCellEditor({
    parent: cell,
    text,
    isDark: root.dataset.dark === '1',
    callbacks: createCellEditorCallbacks(view, root, cell),
  })

  activeCell = { view, root, cell, editor }
  editor.focus()
  editor.dispatch({ selection: resolveCellSelection(editor, target) })
  revealCellHorizontally(root, cell)
  watchCellEditorBlur(view, root, cell, editor)
}

// Доводит ячейку до видимой области, прокручивая ТОЛЬКО внутренний скролл
// таблицы. element.scrollIntoView здесь недопустим: он прокручивает все
// прокручиваемые предки, включая overflow-hidden контейнеры вокруг редактора,
// у которых нет скроллбаров — вернуть их назад пользователь не сможет.
function revealCellHorizontally(root: HTMLElement, cell: HTMLElement) {
  const scroll = root.querySelector<HTMLElement>('[data-table-scroll="1"]')
  if (!scroll)
    return

  const scrollRect = scroll.getBoundingClientRect()
  const cellRect = cell.getBoundingClientRect()

  if (cellRect.left < scrollRect.left) {
    scroll.scrollLeft += cellRect.left - scrollRect.left
  }
  else if (cellRect.right > scrollRect.right) {
    scroll.scrollLeft += Math.min(
      cellRect.right - scrollRect.right,
      cellRect.left - scrollRect.left,
    )
  }
}

// Активирует редактирование ячейки извне виджета (навигация стрелками из
// текста, фокус после вставки таблицы).
export function activateTableCell(
  view: EditorView,
  cell: HTMLElement,
  select: CellSelectionTarget = 'start',
) {
  const root = cell.closest<HTMLElement>('[data-table-widget="1"]')
  if (!root || root.dataset.editable !== '1')
    return

  activateCellEditor(view, root, cell as HTMLTableCellElement, select)
}

// Демонтирует редактор, когда фокус ушёл наружу. Уход в контекстное меню —
// не повод: команды меню должны примениться к активной ячейке.
function watchCellEditorBlur(
  view: EditorView,
  root: HTMLElement,
  cell: HTMLTableCellElement,
  editor: EditorView,
) {
  editor.contentDOM.addEventListener('blur', () => {
    queueMicrotask(() => {
      if (activeCell?.editor !== editor || editor.hasFocus)
        return

      const focused = document.activeElement
      if (
        focused instanceof HTMLElement
        && (cell.contains(focused) || focused.closest('[role="menu"]'))
      ) {
        return
      }

      deactivateCellEditor(view, root)
    })
  })
}

function getNavigableCells(root: HTMLElement): HTMLTableCellElement[] {
  return Array.from(root.querySelectorAll<HTMLTableCellElement>('th, td'))
}

function navigateFromCell(
  view: EditorView,
  root: HTMLElement,
  cell: HTMLTableCellElement,
  direction: 'up' | 'down' | 'prev' | 'next',
  select: CellSelectionTarget,
  options: { createRow?: boolean } = {},
) {
  if (direction === 'prev' || direction === 'next') {
    const cells = getNavigableCells(root)
    const index = cells.indexOf(cell)
    const target = cells[index + (direction === 'next' ? 1 : -1)]

    if (target) {
      activateCellEditor(view, root, target, select)
    }
    else if (direction === 'next' && options.createRow) {
      addRow(view, root, 0)
    }
    else {
      // За крайней ячейкой — выход из таблицы в соответствующую сторону.
      deactivateCellEditor(view, root)
      placeCursorAdjacent(view, root, direction === 'prev')
    }

    return
  }

  const position = getCellPosition(cell)
  if (!position)
    return

  if (direction === 'up' && position.row === 0) {
    deactivateCellEditor(view, root)
    placeCursorAdjacent(view, root, true)
    return
  }

  if (direction === 'down' && position.row >= getLastTableRowIndex(root)) {
    deactivateCellEditor(view, root)
    placeCursorAdjacent(view, root, false)
    return
  }

  const target = getTableCellAt(
    root,
    position.row + (direction === 'down' ? 1 : -1),
    position.column,
  )

  if (target)
    activateCellEditor(view, root, target as HTMLTableCellElement, select)
}

function createCellEditorCallbacks(
  view: EditorView,
  root: HTMLElement,
  cell: HTMLTableCellElement,
) {
  // Навигация и undo выполняются в микрозадаче: они могут уничтожить сам
  // вложенный редактор (демонтаж, структурная пересборка), а делать это
  // синхронно изнутри его же обработчика клавиш небезопасно.
  const defer = (action: () => void) => queueMicrotask(action)

  return {
    onChange: (text: string) => {
      cell.dataset.raw = text
      commitFromDom(view, root, 'input.type')
    },
    onNavigate: (
      direction: 'up' | 'down' | 'prev' | 'next',
      select: CellSelectionTarget,
      options?: { createRow?: boolean },
    ) => {
      defer(() =>
        navigateFromCell(view, root, cell, direction, select, options),
      )
    },
    // Enter — к ячейке той же колонки строкой ниже; на последней строке
    // добавляет новую (как в Obsidian).
    onEnter: () => {
      defer(() => {
        const position = getCellPosition(cell)
        if (!position)
          return

        if (position.row >= getLastTableRowIndex(root)) {
          addRow(view, root, position.column)
          return
        }

        navigateFromCell(view, root, cell, 'down', 'end')
      })
    },
    onEscape: () => {
      defer(() => {
        deactivateCellEditor(view, root)
        placeCursorAdjacent(view, root, false)
      })
    },
    onPasteTabular: (values: string[][]) => {
      defer(() => pasteTabularIntoCell(view, root, cell, values))
    },
    onUndo: () => defer(() => undo(view)),
    onRedo: () => defer(() => redo(view)),
  }
}

// Раскладывает вставленный табличный блок (TSV из Excel, многострочный текст)
// по ячейкам начиная с текущей, расширяя таблицу вправо и вниз по мере нужды.
function pasteTabularIntoCell(
  view: EditorView,
  root: HTMLElement,
  cell: HTMLTableCellElement,
  values: string[][],
) {
  const position = getCellPosition(cell)
  const model = readDomModel(root)
  if (!position || !model || values.length === 0)
    return

  const next: TableModel = {
    header: [...model.header],
    delimiters: [...model.delimiters],
    rows: model.rows.map(row => [...row]),
  }

  const neededColumns
    = position.column + Math.max(...values.map(row => row.length))
  while (next.header.length < neededColumns) {
    next.header.push('')
    next.delimiters.push('---')
    for (const row of next.rows) row.push('')
  }

  // Абсолютные индексы строк: 0 — заголовок, дальше — model.rows[i - 1].
  const lastRow = position.row + values.length - 1
  while (next.rows.length < lastRow)
    next.rows.push(Array.from({ length: next.header.length }, () => ''))

  values.forEach((rowValues, rowOffset) => {
    const absoluteRow = position.row + rowOffset
    rowValues.forEach((value, columnOffset) => {
      const column = position.column + columnOffset
      const text = value.trim()

      if (absoluteRow === 0)
        next.header[column] = text
      else next.rows[absoluteRow - 1][column] = text
    })
  })

  const range = commitModel(view, root, next, 'input.paste')
  if (range) {
    const lastValues = values[values.length - 1]
    requestTableCellFocus(view, {
      tableFrom: range.from,
      selector: cellSelector(
        lastRow,
        position.column + (lastValues?.length ?? 1) - 1,
      ),
    })
  }
}

// ---- Команды таблицы для контекстного меню активной ячейки -----------------

export type TableCellMenuCommand =
  | 'table-insert-row-above'
  | 'table-insert-row-below'
  | 'table-insert-column-left'
  | 'table-insert-column-right'
  | 'table-delete-row'
  | 'table-delete-column'
  | 'table-align-left'
  | 'table-align-center'
  | 'table-align-right'

export interface TableCellMenuContext {
  isHeader: boolean
  alignment: TableColumnAlignment
  canDeleteColumn: boolean
}

// Контекст активной ячейки для секции таблицы в контекстном меню.
export function getActiveTableCellContext(): TableCellMenuContext | null {
  if (!activeCell)
    return null

  const position = getCellPosition(activeCell.cell)
  const model = readDomModel(activeCell.root)
  if (!position || !model)
    return null

  return {
    isHeader: position.row === 0,
    alignment: delimiterAlignment(model.delimiters[position.column] ?? '---'),
    canDeleteColumn: model.header.length > 1,
  }
}

function cellSelector(row: number, column: number): string {
  return row === 0
    ? `thead th:nth-child(${column + 1})`
    : `tbody tr:nth-child(${row}) td:nth-child(${column + 1})`
}

export function runActiveTableCellCommand(command: TableCellMenuCommand) {
  const active = activeCell
  if (!active)
    return

  const { view, root, cell } = active
  const position = getCellPosition(cell)
  const model = readDomModel(root)
  if (!position || !model)
    return

  const { row, column } = position
  // Индекс в model.rows: строка 0 — заголовок.
  const bodyIndex = row - 1
  let next = model
  // Куда вернуть каретку после операции.
  let focusRow = row
  let focusColumn = column

  switch (command) {
    case 'table-insert-row-above':
      if (row === 0)
        return
      next = insertTableRow(model, bodyIndex)
      focusRow = row
      break
    case 'table-insert-row-below':
      next = insertTableRow(model, row === 0 ? 0 : bodyIndex + 1)
      focusRow = row + 1
      break
    case 'table-insert-column-left':
      next = insertTableColumn(model, column)
      break
    case 'table-insert-column-right':
      next = insertTableColumn(model, column + 1)
      focusColumn = column + 1
      break
    case 'table-delete-row':
      if (row === 0)
        return
      next = removeTableRow(model, bodyIndex)
      focusRow = Math.min(row, next.rows.length)
      break
    case 'table-delete-column':
      next = removeTableColumn(model, column)
      focusColumn = Math.min(column, next.header.length - 1)
      break
    case 'table-align-left':
      next = setTableColumnAlignment(model, column, 'left')
      break
    case 'table-align-center':
      next = setTableColumnAlignment(model, column, 'center')
      break
    case 'table-align-right':
      next = setTableColumnAlignment(model, column, 'right')
      break
  }

  if (next === model) {
    // Модель не изменилась (операция невалидна) — просто вернуть фокус.
    active.editor.focus()
    return
  }

  const range = commitModel(view, root, next)
  if (!range)
    return

  // Выравнивание не меняет форму таблицы: редактор ячейки переживает коммит,
  // каретку не трогаем — только возвращаем фокус после закрытия меню.
  if (command.startsWith('table-align-')) {
    activeCell?.editor.focus()
    return
  }

  requestTableCellFocus(view, {
    tableFrom: range.from,
    selector: cellSelector(focusRow, focusColumn),
  })
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

interface TableCellFocusRequest {
  view: EditorView
  tableFrom: number
  selector: string
  mode: 'end' | 'select'
  // Сколько обновлений редактора ждём появления виджета, прежде чем сдаться.
  attempts: number
}

let pendingCellFocus: TableCellFocusRequest | null = null

function findTableWidgetAtOrAfter(
  view: EditorView,
  tableFrom: number,
): HTMLElement | null {
  for (const widget of Array.from(
    view.dom.querySelectorAll<HTMLElement>('[data-table-widget="1"]'),
  )) {
    try {
      if (view.posAtDOM(widget, 0) >= tableFrom)
        return widget
    }
    catch {
      // Виджет мог быть пересоздан между обновлениями.
    }
  }

  return null
}

function fulfillCellFocus(request: TableCellFocusRequest): boolean {
  const widget = findTableWidgetAtOrAfter(request.view, request.tableFrom)
  const cell = widget?.querySelector<HTMLElement>(request.selector)
  if (!cell)
    return false

  // Активация — вне цикла обновления CodeMirror.
  queueMicrotask(() => {
    if (!cell.isConnected)
      return

    activateTableCell(
      request.view,
      cell,
      request.mode === 'select' ? 'all' : 'end',
    )
  })

  return true
}

// Просит сфокусировать ячейку таблицы, начинающейся в tableFrom, как только
// её виджет появится в DOM. Сразу после dispatch виджета может ещё не быть:
// декорации строятся по дереву разбора, а оно достраивается асинхронно —
// в этом случае запрос дожидается ближайшего обновления с готовым виджетом.
export function requestTableCellFocus(
  view: EditorView,
  target: { tableFrom: number, selector: string, mode?: 'end' | 'select' },
) {
  const request: TableCellFocusRequest = {
    view,
    tableFrom: target.tableFrom,
    selector: target.selector,
    mode: target.mode ?? 'end',
    attempts: 10,
  }

  pendingCellFocus = fulfillCellFocus(request) ? null : request
}

const cellFocusListener = EditorView.updateListener.of((update) => {
  // Основной редактор получил фокус — вложенный редактор ячейки демонтируем.
  if (
    update.focusChanged
    && update.view.hasFocus
    && activeCell?.view === update.view
  ) {
    deactivateCellEditor(activeCell.view, activeCell.root)
  }

  const request = pendingCellFocus
  if (!request || request.view !== update.view)
    return

  request.attempts -= 1
  if (fulfillCellFocus(request) || request.attempts <= 0)
    pendingCellFocus = null
})

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

// ---- Структурные операции над таблицей -------------------------------------

// mousedown по contentEditable=false виджету (и по перехваченной зоне под
// последней таблицей) не запускает встроенное drag-выделение CodeMirror,
// поэтому протяжку отслеживаем вручную: клик без движения ведёт себя как
// раньше (onClick ставит каретку), а движение с зажатой левой кнопкой
// выделяет текст от точки нажатия, как на обычном контенте.
const DRAG_SELECT_THRESHOLD = 4

function trackTableAreaSelection(
  view: EditorView,
  event: MouseEvent,
  onClick: () => void,
) {
  const anchor = view.posAtCoords(
    { x: event.clientX, y: event.clientY },
    false,
  )
  let dragging = false

  const move = (moveEvent: MouseEvent) => {
    if (!dragging) {
      if (
        Math.abs(moveEvent.clientX - event.clientX) < DRAG_SELECT_THRESHOLD
        && Math.abs(moveEvent.clientY - event.clientY) < DRAG_SELECT_THRESHOLD
      ) {
        return
      }

      dragging = true
      view.focus()
    }

    const head = view.posAtCoords(
      { x: moveEvent.clientX, y: moveEvent.clientY },
      false,
    )
    view.dispatch({
      selection: EditorSelection.single(anchor, head),
      scrollIntoView: true,
    })
  }

  const stop = () => {
    document.removeEventListener('mousemove', move)
    document.removeEventListener('mouseup', stop)

    // Обычный клик или схлопнувшаяся протяжка — ставим каретку штатным
    // способом, а не паркуем её на атомарной границе таблицы.
    if (!dragging || view.state.selection.main.empty)
      onClick()
  }

  document.addEventListener('mousemove', move)
  document.addEventListener('mouseup', stop)
}

function placeCursorAdjacent(
  view: EditorView,
  root: HTMLElement,
  before: boolean,
) {
  let pos: number
  try {
    pos = view.posAtDOM(root, 0)
  }
  catch {
    return
  }

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

function addColumn(view: EditorView, root: HTMLElement) {
  const model = readDomModel(root)
  if (!model)
    return

  model.header.push('')
  model.delimiters.push('---')
  for (const row of model.rows) row.push('')

  const range = commitModel(view, root, model)
  if (range) {
    requestTableCellFocus(view, {
      tableFrom: range.from,
      selector: 'thead th:last-child',
    })
  }
}

function addRow(view: EditorView, root: HTMLElement, focusColumn = 0) {
  const model = readDomModel(root)
  if (!model)
    return

  model.rows.push(Array.from({ length: model.header.length }, () => ''))
  const column = Math.min(focusColumn, model.header.length - 1)

  const range = commitModel(view, root, model)
  if (range) {
    requestTableCellFocus(view, {
      tableFrom: range.from,
      selector: `tbody tr:last-child td:nth-child(${column + 1})`,
    })
  }
}

function moveColumn(
  view: EditorView,
  root: HTMLElement,
  from: number,
  to: number,
) {
  const model = readDomModel(root)
  if (!model)
    return

  deactivateCellEditor(view, root)

  const range = commitModel(view, root, moveTableColumn(model, from, to))
  if (range) {
    requestTableCellFocus(view, {
      tableFrom: range.from,
      selector: `thead th:nth-child(${getMovedIndex(from, to) + 1})`,
    })
  }
}

function moveRow(
  view: EditorView,
  root: HTMLElement,
  from: number,
  to: number,
) {
  const model = readDomModel(root)
  if (!model)
    return

  deactivateCellEditor(view, root)

  const range = commitModel(view, root, moveTableRow(model, from, to))
  if (range) {
    requestTableCellFocus(view, {
      tableFrom: range.from,
      selector: `tbody tr:nth-child(${getMovedIndex(from, to) + 1}) td:first-child`,
    })
  }
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

// Блочный виджет, заменяющий исходный markdown таблицы её отрисовкой. Ячейки
// отрисовываются статично (inline markdown со скрытыми маркерами); при входе в
// ячейку в неё монтируется вложенный мини-CodeMirror (см. tableCellEditor), а
// каждая его правка сразу коммитится в документ. reconcile обновляет DOM
// точечно, не пересоздавая таблицу под активным редактором.
class TableWidget extends WidgetType {
  constructor(
    readonly model: TableModel,
    readonly source: string,
    // Имя `editable` занято геттером WidgetType, поэтому `interactive`.
    readonly interactive: boolean,
    readonly dark: boolean,
  ) {
    super()
  }

  eq(other: TableWidget): boolean {
    return (
      this.source === other.source && this.interactive === other.interactive
    )
  }

  private startDrag(
    event: PointerEvent,
    view: EditorView,
    root: HTMLElement,
    overlay: HTMLElement,
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
    let pointer = { x: event.clientX, y: event.clientY }
    markDragSelection(overlay, kind, from)

    const update = (clientX: number, clientY: number) => {
      const next
        = kind === 'column'
          ? getColumnIndexAt(root, clientX)
          : getBodyRowIndexAt(root, clientY)

      const handle = getCurrentDragHandle(root)
      if (handle) {
        this.positionDragHandleAtPointer(
          kind === 'column' ? overlay : root,
          handle,
          kind,
          clientX,
          clientY,
        )
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
      markDropTarget(overlay, kind, targetSlot)
    }

    const move = (moveEvent: PointerEvent) => {
      pointer = { x: moveEvent.clientX, y: moveEvent.clientY }
      update(pointer.x, pointer.y)
    }

    // Автоскролл при перетаскивании колонки к обрезанной скроллом области:
    // указатель у края видимой области таблицы прокручивает её.
    const scroll = root.querySelector<HTMLElement>('[data-table-scroll="1"]')
    let autoScrollFrame = 0
    const autoScroll = () => {
      if (kind === 'column' && scroll) {
        const rect = scroll.getBoundingClientRect()
        const zone = 40
        const previous = scroll.scrollLeft

        if (pointer.x > rect.right - zone)
          scroll.scrollLeft += 10
        else if (pointer.x < rect.left + zone)
          scroll.scrollLeft -= 10

        // Контент уехал под указателем — пересчитать цель без pointermove.
        if (scroll.scrollLeft !== previous)
          update(pointer.x, pointer.y)
      }

      autoScrollFrame = requestAnimationFrame(autoScroll)
    }
    autoScrollFrame = requestAnimationFrame(autoScroll)

    const stop = () => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', stop)
      document.removeEventListener('pointercancel', stop)
      cancelAnimationFrame(autoScrollFrame)
      delete root.dataset.tableDragging
      clearDragPreview(root)
      clearFloatingDragHandles(root)

      if (targetSlot === null)
        return

      if (kind === 'column') {
        moveColumn(view, root, from, targetSlot)
      }
      else {
        moveRow(view, root, from, targetSlot)
      }
    }

    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', stop)
    document.addEventListener('pointercancel', stop)
  }

  private createDragHandle(
    view: EditorView,
    root: HTMLElement,
    overlay: HTMLElement,
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
      this.startDrag(event, view, root, overlay, kind, index)
    })

    return handle
  }

  // host — позиционированный контейнер, в который добавлен handle: оверлей
  // для колонок (скроллится с таблицей), root для строк (пришпилен слева).
  private positionDragHandle(
    host: HTMLElement,
    cell: HTMLTableCellElement,
    handle: HTMLElement,
    kind: TableDragKind,
  ) {
    const rootRect = host.getBoundingClientRect()
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
    host: HTMLElement,
    handle: HTMLElement,
    kind: TableDragKind,
    clientX: number,
    clientY: number,
  ) {
    const table
      = host.closest('[data-table-widget]')?.querySelector('table')
        ?? host.querySelector('table')
    if (!table)
      return

    const rootRect = host.getBoundingClientRect()
    const tableRect = table.getBoundingClientRect()

    if (kind === 'column') {
      const centerX = clampColumnHandleCenter(tableRect, clientX)
      handle.style.left = `${centerX - rootRect.left - DRAG_COLUMN_HANDLE_WIDTH / 2}px`
      handle.style.top = `${tableRect.top - rootRect.top - DRAG_HANDLE_SIZE}px`
      return
    }

    const body = table.tBodies[0]
    const bodyRect = body?.getBoundingClientRect() ?? tableRect
    const centerY = clamp(clientY, bodyRect.top, bodyRect.bottom)
    handle.style.left = `${tableRect.left - rootRect.left - DRAG_HANDLE_SIZE / 2}px`
    handle.style.top = `${centerY - rootRect.top - DRAG_HANDLE_SIZE / 2}px`
  }

  private showDragHandle(
    root: HTMLElement,
    overlay: HTMLElement,
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

    // Колоночный handle скроллится вместе с колонкой (живёт в оверлее),
    // строчный — пришпилен к видимому левому краю (живёт на root).
    const host = kind === 'column' ? overlay : root
    const handle = this.createDragHandle(view, root, overlay, kind, index)
    this.positionDragHandle(host, cell, handle, kind)
    host.append(handle)
    markDragSelection(overlay, kind, index)
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
    overlay: HTMLElement,
  ) {
    if (root.dataset.tableDragging === '1')
      return

    const column = getColumnHoverTarget(root, event.clientX, event.clientY)
    if (column) {
      this.showDragHandle(
        root,
        overlay,
        view,
        'column',
        column.index,
        column.cell,
      )
      return
    }

    const row = getRowHoverTarget(root, event.clientX, event.clientY)
    if (row) {
      this.showDragHandle(root, overlay, view, 'row', row.index, row.cell)
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

  private attachDragHover(
    view: EditorView,
    root: HTMLElement,
    overlay: HTMLElement,
  ) {
    root.addEventListener('pointermove', event =>
      this.onRootPointerMove(event, view, root, overlay))
    root.addEventListener('pointerleave', event =>
      this.onRootPointerLeave(root, event))
  }

  private createCell(
    tag: 'th' | 'td',
    text: string,
    column: number,
  ): HTMLTableCellElement {
    const cell = document.createElement(tag)
    renderCell(cell, unescapeCell(text))
    cell.style.position = 'relative'
    cell.style.minWidth = `${TABLE_CELL_MIN_WIDTH}px`
    cell.style.textAlign = delimiterAlignment(
      this.model.delimiters[column] ?? '---',
    )
    cell.style.color = 'var(--foreground)'
    cell.style.padding = tag === 'th' ? '8px 10px' : '7px 10px'
    cell.style.borderBottom = '1px solid var(--border)'

    if (tag === 'th') {
      cell.style.fontWeight = '600'
      cell.style.background
        = 'color-mix(in oklch, var(--muted) 72%, var(--background))'
    }

    if (this.interactive)
      cell.style.cursor = 'text'

    return cell
  }

  private buildTable(): HTMLTableElement {
    const table = document.createElement('table')
    table.style.width = 'max-content'
    table.style.minWidth = 'max-content'
    table.style.borderCollapse = 'collapse'

    const thead = document.createElement('thead')
    const headerRow = document.createElement('tr')
    for (const [column, text] of this.model.header.entries())
      headerRow.append(this.createCell('th', text, column))

    thead.append(headerRow)
    table.append(thead)

    const tbody = document.createElement('tbody')
    for (const row of this.model.rows) {
      const tr = document.createElement('tr')
      for (const [column, text] of row.entries())
        tr.append(this.createCell('td', text, column))

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
    root.dataset.dark = this.dark ? '1' : '0'
    root.dataset.tableDelimiters = JSON.stringify(this.model.delimiters)
    root.contentEditable = 'false'
    root.style.position = 'relative'
    // Обнуляет intrinsic-ширину виджета: без этого широкая таблица
    // протаскивает свою min-content-ширину через cm-content и overflow-hidden
    // предков до grid-панели редактора — у них появляется скрытое
    // горизонтальное переполнение, и браузер при reveal каретки прокручивает
    // их влево (визуально «пропадает» левый отступ до пересоздания DOM).
    root.style.contain = 'inline-size'

    // root и scroll — обычные блоки на всю ширину: fit-content + max-width в
    // процентах внутри shrink-to-fit контейнера разрешаются хрупко и могут
    // дать переполнение контента редактора широкой таблицей.
    const scroll = document.createElement('div')
    scroll.dataset.tableScroll = '1'
    scroll.style.overflowX = 'auto'

    // Позиционированный слой ВНУТРИ скролла: кнопки добавления, колоночные
    // drag-handle и превью перетаскивания привязаны к реальному краю таблицы
    // и уезжают вместе с ней при горизонтальном скролле (как в Obsidian), а
    // не прижимаются к видимой области.
    const overlay = document.createElement('div')
    overlay.dataset.tableOverlay = '1'
    overlay.style.position = 'relative'
    overlay.style.width = 'max-content'

    const frame = document.createElement('div')
    frame.style.width = 'max-content'
    frame.style.border = '1px solid var(--border)'
    frame.style.borderRadius = '8px'
    frame.style.background = 'var(--background)'
    frame.style.overflow = 'hidden'

    if (this.interactive) {
      overlay.style.paddingTop = `${DRAG_HANDLE_SIZE}px`
      overlay.style.paddingRight = `${GUTTER}px`
      overlay.style.paddingBottom = `${GUTTER + STRIP}px`
    }

    frame.append(this.buildTable())
    overlay.append(frame)
    scroll.append(overlay)
    root.append(scroll)

    if (this.interactive) {
      // Клик мимо ячеек и gutter'ов (по полоскам сверху/снизу) ставит каретку
      // до или после таблицы — это единственный способ начать писать рядом с
      // блок-виджетом, который иначе занимает всю строку.
      root.addEventListener('mousedown', (event) => {
        const target = event.target as HTMLElement

        // Клик по ячейке (включая правый — для контекстного меню) монтирует
        // в неё вложенный редактор с кареткой в точке клика. Клики внутри
        // уже активной ячейки обрабатывает сам вложенный редактор.
        const cell = target.closest<HTMLTableCellElement>('th, td')
        if (cell) {
          if (activeCell?.cell === cell)
            return

          event.preventDefault()
          activateCellEditor(view, root, cell, {
            coords: { x: event.clientX, y: event.clientY },
          })
          return
        }

        if (
          target.closest('[data-table-gutter]')
          || target.closest('[data-table-drag-handle]')
          || target.closest('[data-table-drag-zone]')
        ) {
          return
        }

        if (event.button !== 0)
          return

        event.preventDefault()
        // mousedown внутри виджета не доходит до domEventHandlers
        // (ignoreEvent), поэтому замораживаем reveal-selection явно.
        freezeRevealSelectionUntilMouseup(view)
        const rect = scroll.getBoundingClientRect()
        const before = event.clientY < rect.top + rect.height / 2
        trackTableAreaSelection(view, event, () =>
          placeCursorAdjacent(view, root, before))
      })
      this.attachDragHover(view, root, overlay)

      // Зона наведения строк пришпилена к видимому левому краю (строки не
      // двигаются при горизонтальном скролле), кнопки добавления — в
      // скроллящемся оверлее у настоящих краёв таблицы.
      root.append(this.createRowDragHoverZone())
      overlay.append(
        this.createGutter('column', () => addColumn(view, root)),
        this.createGutter('row', () => addRow(view, root)),
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

    // Реконсиляция может дописывать во вложенный редактор (undo/redo), а его
    // onChange коммитит во внешний view — во время цикла обновления это
    // запрещено, поэтому глушим коммиты флагом (с восстановлением: updateDOM
    // может выполняться и внутри уже идущего коммита).
    const wasCommitting = committing
    committing = true
    try {
      this.reconcile(view, dom, table, head, body)
    }
    finally {
      committing = wasCommitting
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
      // Пересборка уничтожает ячейку вместе со смонтированным редактором
      // (например, при undo структурной правки) — переактивируем ближайшую
      // ячейку новой таблицы с прежней позицией каретки.
      const active = getActiveCellFor(dom)
      let restore: { row: number, column: number, offset: number } | null
        = null

      if (active && dom.contains(active.cell)) {
        const position = getCellPosition(active.cell)
        if (position) {
          restore = {
            ...position,
            offset: active.editor.state.selection.main.head,
          }
        }
      }

      if (active)
        disposeCellEditor(dom)

      table.replaceWith(this.buildTable())

      if (restore) {
        const row = Math.min(restore.row, this.model.rows.length)
        const column = Math.min(restore.column, this.model.header.length - 1)
        const offset = restore.offset
        queueMicrotask(() => {
          const cell = getTableCellAt(dom, row, column)
          if (cell?.isConnected) {
            activateCellEditor(view, dom, cell as HTMLTableCellElement, {
              offset,
            })
          }
        })
      }

      return
    }

    const active = getActiveCellFor(dom)
    const apply = (
      cell: HTMLTableCellElement | undefined,
      text: string,
      column: number,
    ) => {
      if (!cell)
        return

      // Выравнивание может поменяться и без изменения текста ячейки.
      cell.style.textAlign = delimiterAlignment(
        this.model.delimiters[column] ?? '---',
      )

      const display = unescapeCell(text)

      if (active && cell === active.cell) {
        const editorText = active.editor.state.doc.toString()
        if (editorText === display)
          return

        // Расхождение только из-за нормализации сериализацией (trim) —
        // редактор авторитетен: перезапись стирала бы, например, хвостовой
        // пробел прямо во время набора.
        if (escapeCell(editorText) === text)
          return

        // Реальное внешнее изменение (undo/redo, замена контента) — обновляем
        // документ вложенного редактора, сохраняя позицию каретки.
        const head = Math.min(
          active.editor.state.selection.main.head,
          display.length,
        )
        active.editor.dispatch({
          changes: {
            from: 0,
            to: active.editor.state.doc.length,
            insert: display,
          },
          selection: { anchor: head },
        })
        cell.dataset.raw = display
        return
      }

      if (getCellText(cell) !== display)
        setCellText(cell, display)
    }

    this.model.header.forEach((text, col) =>
      apply(head.rows[0]?.cells[col], text, col),
    )
    this.model.rows.forEach((row, ri) =>
      row.forEach((text, col) => apply(body.rows[ri]?.cells[col], text, col)),
    )
  }

  destroy(dom: HTMLElement) {
    const active = getActiveCellFor(dom)
    disposeCellEditor(dom)

    // Виджет уничтожен вместе с активным редактором (например, undo убрал
    // таблицу целиком) — возвращаем фокус в основной редактор.
    if (active) {
      const outer = active.view
      queueMicrotask(() => {
        if (!activeCell && !outer.hasFocus)
          outer.focus()
      })
    }
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
  trackTableAreaSelection(view, event, () =>
    placeCursorAfterTableRange(view, range))

  return true
}

// Вставка TSV (скопированные ячейки Excel/Numbers) в текст заметки создаёт
// markdown-таблицу: первая строка — заголовок. Эвристики против ложных
// срабатываний на код с табуляцией: одинаковое число колонок (>= 2) во всех
// строках и хотя бы одна непустая первая колонка.
function maybePasteTsvAsTable(
  view: EditorView,
  event: ClipboardEvent,
): boolean {
  const text = event.clipboardData?.getData('text/plain') ?? ''
  if (!text.includes('\t'))
    return false

  // Внутри код-блоков табуляция легитимна.
  const head = view.state.selection.main.head
  const tree = syntaxTree(view.state)
  let node: ReturnType<typeof tree.resolveInner> | null = tree.resolveInner(
    head,
    -1,
  )
  while (node) {
    if (
      node.name === 'FencedCode'
      || node.name === 'CodeBlock'
      || node.name === 'InlineCode'
    ) {
      return false
    }
    node = node.parent
  }

  const lines = text
    .replace(/\r/g, '')
    .split('\n')
    .filter(line => line.trim() !== '')
  if (lines.length === 0)
    return false

  const values = lines.map(line =>
    line.split('\t').map(cell => cell.trim()),
  )
  const columns = values[0].length
  if (columns < 2 || values.some(row => row.length !== columns))
    return false
  if (values.every(row => row[0] === ''))
    return false

  event.preventDefault()

  const source = serializeTable({
    header: values[0],
    delimiters: Array.from({ length: columns }, () => '---'),
    rows: values.slice(1),
  })

  const main = view.state.selection.main
  const { doc } = view.state

  // Таблица — блочный элемент: между ней и соседним контентом должна быть
  // пустая строка (как в Obsidian). Без неё смежные markdown-таблицы
  // склеиваются в один Table-узел при парсинге.
  const b1 = main.from > 0 ? doc.sliceString(main.from - 1, main.from) : ''
  const b2 = main.from > 1 ? doc.sliceString(main.from - 2, main.from - 1) : ''
  let lead = ''
  if (main.from > 0) {
    if (b1 !== '\n')
      lead = '\n\n'
    else if (main.from > 1 && b2 !== '\n')
      lead = '\n'
  }

  const a1 = main.to < doc.length ? doc.sliceString(main.to, main.to + 1) : ''
  const a2
    = main.to + 1 < doc.length ? doc.sliceString(main.to + 1, main.to + 2) : ''
  let trail = '\n'
  if (main.to < doc.length) {
    if (a1 !== '\n')
      trail = '\n\n'
    else if (main.to + 1 < doc.length && a2 !== '\n')
      trail = '\n'
    else trail = ''
  }

  // Курсор — на пустую строку ПОСЛЕ таблицы, не на границу блок-виджета:
  // каретка вплотную к contentEditable=false виджету заставляет браузер
  // «доводить» её по правому краю широкой таблицы и прокручивать
  // overflow-hidden предков редактора (см. revealCellHorizontally).
  view.dispatch({
    changes: {
      from: main.from,
      to: main.to,
      insert: `${lead}${source}${trail}`,
    },
    selection: EditorSelection.cursor(
      main.from + lead.length + source.length + 1,
    ),
    scrollIntoView: true,
    userEvent: 'input.paste',
  })

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

  // Защищаем только последнюю пустую строку-разделитель перед таблицей:
  // если выше есть ещё пустые, они лишние и удаляются как обычный текст.
  if (lineNumber > 1 && state.doc.line(lineNumber - 1).text.trim() === '')
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

// Backspace в начале строки сразу после таблицы: атомарный блок иначе
// удалился бы целиком одним нажатием — вместо этого входим в последнюю ячейку.
function enterTableOnBackspaceAfter(view: EditorView): boolean {
  const { state } = view
  const selection = state.selection.main
  if (!selection.empty || selection.head === 0)
    return false

  const line = state.doc.lineAt(selection.head)
  if (selection.head !== line.from || line.number <= 1)
    return false

  const prevLine = state.doc.line(line.number - 1)
  const range = getTableRangeAt(state, prevLine.to)
  if (!range || range.to !== prevLine.to)
    return false

  const widget = findTableWidgetAtOrAfter(view, range.from)
  const cell
    = widget?.querySelector<HTMLElement>('tbody tr:last-child td:last-child')
      ?? widget?.querySelector<HTMLElement>('thead th:last-child')
  if (!cell)
    return false

  activateTableCell(view, cell, 'end')
  return true
}

// Delete в конце строки прямо перед таблицей: вход в первую ячейку вместо
// удаления всего атомарного блока.
function enterTableOnDeleteBefore(view: EditorView): boolean {
  const { state } = view
  const selection = state.selection.main
  if (!selection.empty)
    return false

  const line = state.doc.lineAt(selection.head)
  if (selection.head !== line.to || line.number >= state.doc.lines)
    return false

  const next = state.doc.line(line.number + 1)
  if (!findTableRangeStartingAt(state, next.from))
    return false

  const widget = findTableWidgetAtOrAfter(view, next.from)
  const cell = widget?.querySelector<HTMLElement>('thead th:first-child')
  if (!cell)
    return false

  activateTableCell(view, cell, 'start')
  return true
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

  const inputs: { from: number, text: string }[] = []

  transaction.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    if (inputs.length || fromA !== toA)
      return

    const text = inserted.toString()
    if (!text || text.includes('\n'))
      return

    inputs.push({ from: fromA, text })
  })

  const input = inputs[0]
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
  isDark: boolean,
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
          widget: new TableWidget(model, source, editable, isDark),
        }),
      )
    },
  })

  return builder.finish()
}

export function createTableBlocks(options: TableBlocksOptions = {}): Extension {
  const { enabled = true, editable = false, isDark = false } = options

  const decorations = StateField.define<DecorationSet>({
    create(state) {
      return buildDecorations(state, enabled, editable, isDark)
    },
    update(value, transaction) {
      // Дерево разбора может достроиться асинхронно (без изменения документа),
      // поэтому сравниваем идентичность деревьев, чтобы подхватить такие блоки.
      const treeChanged
        = syntaxTree(transaction.startState) !== syntaxTree(transaction.state)

      if (transaction.docChanged || treeChanged)
        return buildDecorations(transaction.state, enabled, editable, isDark)

      return value
    },
    provide: field => EditorView.decorations.from(field),
  })

  // Таблица для навигации во внешнем редакторе — один атомарный блок:
  // стрелки и удаление не ходят посимвольно по скрытому markdown.
  const atomicBlocks = EditorView.atomicRanges.of(view =>
    view.state.field(decorations),
  )

  if (!editable)
    return [decorations, atomicBlocks]

  return [
    decorations,
    atomicBlocks,
    cellFocusListener,
    EditorState.transactionFilter.of(preserveTableBoundaryOnInput),
    Prec.highest(
      keymap.of([
        // Вход в таблицу выше — раньше ухода на защищённую границу: на
        // пустой строке между двумя таблицами Backspace должен вести в
        // последнюю ячейку верхней таблицы, а не парковать курсор на её
        // атомарной границе, где следующий Backspace удалил бы таблицу
        // целиком.
        {
          key: 'Backspace',
          run: enterTableOnBackspaceAfter,
        },
        {
          key: 'Backspace',
          run: moveBeforeProtectedTableBoundary,
        },
        {
          key: 'Delete',
          run: preventProtectedTableBoundaryDelete,
        },
        {
          key: 'Delete',
          run: enterTableOnDeleteBefore,
        },
      ]),
    ),
    EditorView.domEventHandlers({
      mousedown(event, view) {
        return maybePlaceCursorAfterTableClick(view, event)
      },
      paste(event, view) {
        return maybePasteTsvAsTable(view, event)
      },
    }),
  ]
}

export const tableBlocks = createTableBlocks()
