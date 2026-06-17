import type { EditorState } from '@codemirror/state'
import type { TableModel } from './tableParser'
import { i18n } from '@/electron'
import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder, StateField } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  WidgetType,
} from '@codemirror/view'
import {
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

// Ширина зарезервированной зоны у правого/нижнего края, в которой при наведении
// появляются кнопки «добавить столбец» / «добавить строку».
const GUTTER = 16

// Высота тонких полосок над и под таблицей: клик по ним ставит каретку на
// строку до/после таблицы (иначе блок-виджет не оставляет места для клика).
const STRIP = 6

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

  const header = Array.from(head.rows[0]?.cells ?? []).map(
    cell => cell.textContent ?? '',
  )
  const rows = Array.from(body.rows).map(tr =>
    Array.from(tr.cells).map(cell => cell.textContent ?? ''),
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

function getTableRangeAt(
  state: EditorState,
  pos: number,
): { from: number, to: number } | null {
  let result: { from: number, to: number } | null = null

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
  cell.focus()
  const range = document.createRange()
  range.selectNodeContents(cell)
  range.collapse(false)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

function getEditableCells(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'th[contenteditable], td[contenteditable]',
    ),
  )
}

// После добавления столбца/строки DOM пересобирается из новой модели, поэтому
// фокус в нужную ячейку ставим в микрозадаче — уже по обновлённому DOM.
function focusAfterStructureChange(root: HTMLElement, selector: string) {
  queueMicrotask(() => {
    const cell = root.querySelector<HTMLElement>(selector)
    if (cell)
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
        focusCellEnd(next)
      }
      else {
        cell.blur()
      }
    }
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

  private createCell(
    tag: 'th' | 'td',
    text: string,
    view: EditorView,
    root: HTMLElement,
  ): HTMLTableCellElement {
    const cell = document.createElement(tag)
    cell.textContent = unescapeCell(text)
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
    table.style.width = '100%'
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

  private addRow(view: EditorView, root: HTMLElement) {
    const model = readDomModel(root)
    if (!model)
      return

    model.rows.push(Array.from({ length: model.header.length }, () => ''))

    commitModel(view, root, model)
    focusAfterStructureChange(root, 'tbody tr:last-child td:first-child')
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

    const { doc } = view.state

    if (before) {
      const startLine = doc.lineAt(range.from)
      const prev = startLine.number > 1 ? doc.line(startLine.number - 1) : null
      if (prev && prev.text.trim() === '') {
        view.dispatch({
          selection: { anchor: prev.from },
          scrollIntoView: true,
        })
      }
      else {
        view.dispatch({
          changes: { from: range.from, insert: '\n' },
          selection: { anchor: range.from },
          scrollIntoView: true,
        })
      }
    }
    else {
      const endLine = doc.lineAt(range.to)
      const next
        = endLine.number < doc.lines ? doc.line(endLine.number + 1) : null
      if (next && next.text.trim() === '') {
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
        })
      }
    }

    view.focus()
  }

  private createGutter(
    orientation: 'column' | 'row',
    label: string,
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
      gutter.style.top = `${STRIP}px`
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

    const tooltip = document.createElement('div')
    tooltip.textContent = label
    tooltip.style.position = 'absolute'
    tooltip.style.padding = '4px 8px'
    tooltip.style.background = 'var(--popover)'
    tooltip.style.color = 'var(--popover-foreground)'
    tooltip.style.border = '1px solid var(--border)'
    tooltip.style.borderRadius = '6px'
    tooltip.style.fontFamily = 'var(--font-sans)'
    tooltip.style.fontSize = '12px'
    tooltip.style.lineHeight = '1.2'
    tooltip.style.whiteSpace = 'nowrap'
    tooltip.style.pointerEvents = 'none'
    tooltip.style.boxShadow = '0 2px 8px rgb(0 0 0 / 0.18)'
    tooltip.style.zIndex = '20'
    tooltip.style.opacity = '0'
    tooltip.style.transition = 'opacity 0.12s ease'
    tooltip.style.top = 'calc(100% + 6px)'
    if (orientation === 'column') {
      tooltip.style.right = '0'
    }
    else {
      tooltip.style.left = '50%'
      tooltip.style.transform = 'translateX(-50%)'
    }
    gutter.append(tooltip)

    gutter.addEventListener('mouseenter', () => {
      gutter.style.opacity = '1'
      gutter.style.background
        = 'color-mix(in oklch, var(--accent) 60%, transparent)'
      gutter.style.color = 'var(--foreground)'
      tooltip.style.opacity = '1'
    })
    gutter.addEventListener('mouseleave', () => {
      gutter.style.opacity = '0'
      gutter.style.background = 'transparent'
      gutter.style.color = 'var(--muted-foreground)'
      tooltip.style.opacity = '0'
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

  toDOM(view: EditorView): HTMLElement {
    const root = document.createElement('div')
    root.dataset.tableWidget = '1'
    root.dataset.editable = this.interactive ? '1' : '0'
    root.dataset.tableDelimiters = JSON.stringify(this.model.delimiters)
    root.contentEditable = 'false'
    root.style.position = 'relative'

    const scroll = document.createElement('div')
    scroll.style.overflowX = 'auto'
    scroll.style.border = '1px solid var(--border)'
    scroll.style.borderRadius = '8px'
    scroll.style.background = 'var(--background)'

    if (this.interactive) {
      root.style.paddingTop = `${STRIP}px`
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
        if (target.closest('th, td') || target.closest('[data-table-gutter]'))
          return

        event.preventDefault()
        const rect = scroll.getBoundingClientRect()
        const before = event.clientY < rect.top + rect.height / 2
        this.placeCursorAdjacent(view, root, before)
      })

      root.append(
        this.createGutter(
          'column',
          i18n.t('notes.editor.table.addColumn'),
          () => this.addColumn(view, root),
        ),
        this.createGutter('row', i18n.t('notes.editor.table.addRow'), () =>
          this.addRow(view, root)),
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
      if (cell.textContent !== display)
        cell.textContent = display
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

export function createTableBlocks(options: TableBlocksOptions = {}) {
  const { enabled = true, editable = false } = options

  return StateField.define<DecorationSet>({
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
}

export const tableBlocks = createTableBlocks()
