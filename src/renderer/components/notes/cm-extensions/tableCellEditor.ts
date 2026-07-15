import { createCodeHighlight } from '@/components/cm-extensions/codeHighlight'
import { defaultKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { EditorState, Prec } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { GFM } from '@lezer/markdown'
import { createHideMarkup } from './hideMarkup'
import { createMarkdownDecorations } from './markdownDecorations'
import { Highlight } from './markdownHighlight'
import { markdownShortcuts } from './markdownShortcuts'

// Вложенный мини-редактор для активной ячейки таблицы (подход Obsidian):
// внутри ячейки живёт полноценный CodeMirror с теми же live-preview
// расширениями, что и основной редактор. Selection, IME, вставка, скрытие
// markdown-разметки вокруг курсора — всё нативное; наружу уходят только
// изменения текста и навигационные намерения.

// Как поставить каретку в ячейке при активации её редактора. Вариант с `x` —
// сохранение визуальной колонки при вертикальных переходах: каретка встаёт
// на верхнюю/нижнюю визуальную строку ячейки в заданной X-координате.
export type CellSelectionTarget =
  | 'start'
  | 'end'
  | 'all'
  | { offset: number }
  | { coords: { x: number, y: number } }
  | { x: number, edge: 'top' | 'bottom' }

export interface TableCellEditorCallbacks {
  // Каждое изменение текста ячейки (для коммита в документ).
  onChange: (text: string) => void
  // Навигация за границу ячейки: куда идём и куда поставить каретку в цели.
  // createRow — Tab за последней ячейкой создаёт строку; стрелка вправо
  // вместо этого выходит из таблицы.
  onNavigate: (
    direction: 'up' | 'down' | 'prev' | 'next',
    select: CellSelectionTarget,
    options?: { createRow?: boolean },
  ) => void
  // Enter: переход к ячейке строкой ниже (или создание строки).
  onEnter: () => void
  // Escape: выход из ячейки в основной редактор.
  onEscape: () => void
  // Вставка табличных данных (TSV/многострочный текст): раскладывается по
  // ячейкам начиная с текущей.
  onPasteTabular: (values: string[][]) => void
  onUndo: () => void
  onRedo: () => void
}

export interface TableCellEditorOptions {
  parent: HTMLElement
  text: string
  isDark: boolean
  callbacks: TableCellEditorCallbacks
}

// Редактор не должен менять геометрию ячейки: никаких собственных отступов,
// шрифт и межстрочный интервал — из ячейки.
const cellTheme = EditorView.theme({
  '&': {
    backgroundColor: 'transparent',
    fontSize: 'inherit',
    fontFamily: 'inherit',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-scroller': {
    fontFamily: 'inherit',
    lineHeight: 'inherit',
    overflow: 'visible',
  },
  '.cm-content': {
    margin: '0',
    maxWidth: 'none',
    padding: '0',
    caretColor: 'var(--foreground)',
  },
  '.cm-line': {
    padding: '0',
  },
  '.cm-selectionBackground': {
    backgroundColor: 'var(--accent)',
  },
})

// Ячейка — одна строка markdown: переносы из вставки схлопываются в пробел.
const singleLineFilter = EditorState.transactionFilter.of((transaction) => {
  if (!transaction.docChanged)
    return transaction

  let hasNewline = false
  transaction.changes.iterChanges((_fromA, _toA, _fromB, _toB, inserted) => {
    if (inserted.toString().includes('\n'))
      hasNewline = true
  })

  if (!hasNewline)
    return transaction

  const changes: { from: number, to: number, insert: string }[] = []
  transaction.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    changes.push({
      from: fromA,
      to: toA,
      insert: inserted.toString().replace(/[\r\n]+/g, ' '),
    })
  })

  // Каретка — после последней вставки в координатах нового документа:
  // `last.from` задан в старых координатах, сдвиги от предыдущих изменений
  // транзакции учитываем вручную.
  const last = changes[changes.length - 1]
  const shift = changes
    .slice(0, -1)
    .reduce(
      (sum, change) => sum + change.insert.length - (change.to - change.from),
      0,
    )

  return {
    changes,
    selection: { anchor: last.from + shift + last.insert.length },
    scrollIntoView: transaction.scrollIntoView,
    userEvent: 'input.paste',
  }
})

// Каретка на крайней (первой/последней) визуальной строке ячейки. Сравниваем
// вертикальные координаты с краем документа: сама позиция каретки не годится —
// moveVertically на первой строке сдвигает каретку к началу, а при переносе
// длинного текста строк внутри ячейки несколько, и стрелки сначала должны
// ходить по ним.
function isOnEdgeVisualLine(view: EditorView, forward: boolean): boolean {
  const head = view.state.selection.main.head
  const headCoords = view.coordsAtPos(head)
  const edgeCoords = view.coordsAtPos(forward ? view.state.doc.length : 0)

  if (!headCoords || !edgeCoords)
    return true

  return Math.abs(headCoords.top - edgeCoords.top) < 2
}

function createCellKeymap(callbacks: TableCellEditorCallbacks) {
  const head = (view: EditorView) => view.state.selection.main.head

  return [
    {
      key: 'Tab',
      run: () => {
        callbacks.onNavigate('next', 'all', { createRow: true })
        return true
      },
      shift: () => {
        callbacks.onNavigate('prev', 'all')
        return true
      },
    },
    {
      key: 'Enter',
      run: () => {
        callbacks.onEnter()
        return true
      },
    },
    {
      key: 'Escape',
      run: () => {
        callbacks.onEscape()
        return true
      },
    },
    {
      key: 'ArrowUp',
      run: (view: EditorView) => {
        if (!isOnEdgeVisualLine(view, false))
          return false

        const coords = view.coordsAtPos(head(view))
        callbacks.onNavigate(
          'up',
          coords ? { x: coords.left, edge: 'bottom' } : { offset: head(view) },
        )
        return true
      },
    },
    {
      key: 'ArrowDown',
      run: (view: EditorView) => {
        if (!isOnEdgeVisualLine(view, true))
          return false

        const coords = view.coordsAtPos(head(view))
        callbacks.onNavigate(
          'down',
          coords ? { x: coords.left, edge: 'top' } : { offset: head(view) },
        )
        return true
      },
    },
    {
      key: 'ArrowLeft',
      run: (view: EditorView) => {
        const range = view.state.selection.main
        if (!range.empty || range.head > 0)
          return false

        callbacks.onNavigate('prev', 'end')
        return true
      },
    },
    {
      key: 'ArrowRight',
      run: (view: EditorView) => {
        const range = view.state.selection.main
        if (!range.empty || range.head < view.state.doc.length)
          return false

        callbacks.onNavigate('next', 'start')
        return true
      },
    },
    {
      key: 'Mod-z',
      run: () => {
        callbacks.onUndo()
        return true
      },
      shift: () => {
        callbacks.onRedo()
        return true
      },
    },
    {
      key: 'Mod-y',
      run: () => {
        callbacks.onRedo()
        return true
      },
    },
  ]
}

export function createTableCellEditor(
  options: TableCellEditorOptions,
): EditorView {
  const { parent, text, isDark, callbacks } = options

  const state = EditorState.create({
    doc: text,
    extensions: [
      cellTheme,
      EditorView.lineWrapping,
      singleLineFilter,
      Prec.highest(keymap.of(createCellKeymap(callbacks))),
      // defaultKeymap обязателен: клавиши, не обработанные keymap'ами, уходят
      // в нативный contenteditable, а тот может увести selection из ячейки
      // во внешний документ.
      keymap.of([...markdownShortcuts, ...defaultKeymap]),
      markdown({
        base: markdownLanguage,
        extensions: [GFM, Highlight],
      }),
      createCodeHighlight(isDark),
      createMarkdownDecorations({ interactiveTaskMarkers: false }),
      createHideMarkup(),
      // TSV/многострочная вставка уходит в таблицу целиком, а не в одну
      // ячейку (переносы иначе схлопнулись бы в пробелы).
      EditorView.domEventHandlers({
        paste(event) {
          const text = event.clipboardData?.getData('text/plain') ?? ''
          const lines = text
            .replace(/\r/g, '')
            .split('\n')
            .filter(line => line !== '')

          const values = lines.map(line => line.split('\t'))
          const isTabular = values.length > 1 || (values[0]?.length ?? 0) > 1

          if (!isTabular)
            return false

          event.preventDefault()
          callbacks.onPasteTabular(values)
          return true
        },
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged)
          callbacks.onChange(update.state.doc.toString())
      }),
    ],
  })

  const view = new EditorView({ state, parent })
  // Инлайном — как гарантия поверх тем внешнего редактора: их padding
  // раздувал ячейку по вертикали, а max-width + margin:auto центрировали
  // вложенный контент и создавали большой отступ слева.
  view.contentDOM.style.margin = '0'
  view.contentDOM.style.maxWidth = 'none'
  view.contentDOM.style.padding = '0'

  return view
}
