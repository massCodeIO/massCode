import type {
  ChangeSpec,
  EditorState,
  SelectionRange,
} from '@codemirror/state'
import type { KeyBinding } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { EditorSelection } from '@codemirror/state'

type EditorViewLike = Parameters<NonNullable<KeyBinding['run']>>[0]
// @lezer/common — транзитивная зависимость, тип достаём через syntaxTree.
type SyntaxNode = ReturnType<ReturnType<typeof syntaxTree>['resolveInner']>

// Inline-стиль: пара «узел дерева разбора + его mark-узлы». Toggle работает по
// дереву, а не по строкам: только так курсор внутри `**bold**` снимает жирный,
// а Mod-i поверх `**bold**` не съедает по звёздочке с каждой стороны.
interface InlineStyleSpec {
  marker: string
  node: string
  mark: string
}

const INLINE_STYLES: Record<string, InlineStyleSpec> = {
  '**': { marker: '**', node: 'StrongEmphasis', mark: 'EmphasisMark' },
  '*': { marker: '*', node: 'Emphasis', mark: 'EmphasisMark' },
  '~~': { marker: '~~', node: 'Strikethrough', mark: 'StrikethroughMark' },
  '==': { marker: '==', node: 'Highlight', mark: 'HighlightMark' },
  '`': { marker: '`', node: 'InlineCode', mark: 'CodeMark' },
}

// Ищет узел стиля, целиком накрывающий диапазон. Обе стороны resolveInner —
// чтобы курсор на границе спана (например, сразу после `**bold**`) тоже
// считался «внутри».
function findEnclosingStyleNode(
  state: EditorState,
  from: number,
  to: number,
  nodeName: string,
): SyntaxNode | null {
  const tree = syntaxTree(state)

  for (const side of [1, -1] as const) {
    let current: SyntaxNode | null = tree.resolveInner(from, side)

    while (current) {
      if (current.name === nodeName && current.from <= from && current.to >= to)
        return current

      current = current.parent
    }
  }

  return null
}

function getStyleMarks(
  node: SyntaxNode,
  spec: InlineStyleSpec,
): { from: number, to: number }[] {
  const marks: { from: number, to: number }[] = []

  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.name === spec.mark)
      marks.push({ from: child.from, to: child.to })
  }

  if (marks.length >= 2)
    return marks

  // Fallback на границы узла — на случай, если mark-узлы не материализованы.
  return [
    { from: node.from, to: node.from + spec.marker.length },
    { from: node.to - spec.marker.length, to: node.to },
  ]
}

interface InlineToggleResult {
  changes: ChangeSpec[]
  selection: { anchor: number, head?: number }
}

export function computeInlineToggle(
  state: EditorState,
  range: SelectionRange,
  marker: string,
): InlineToggleResult {
  const spec = INLINE_STYLES[marker] ?? {
    marker,
    node: '',
    mark: '',
  }

  const enclosing = spec.node
    ? findEnclosingStyleNode(state, range.from, range.to, spec.node)
    : null

  if (enclosing) {
    const marks = getStyleMarks(enclosing, spec)
    const open = marks[0]
    const close = marks[marks.length - 1]

    // Сдвиг позиции после удаления открывающего и закрывающего маркеров.
    const shift = (pos: number) => {
      let next = pos
      if (pos > open.from)
        next -= Math.min(pos, open.to) - open.from
      if (pos > close.from)
        next -= Math.min(pos, close.to) - close.from
      return next
    }

    return {
      changes: [
        { from: open.from, to: open.to, insert: '' },
        { from: close.from, to: close.to, insert: '' },
      ],
      selection: { anchor: shift(range.from), head: shift(range.to) },
    }
  }

  let { from, to } = range

  // Пустое выделение внутри слова форматирует всё слово (как в Obsidian),
  // курсор остаётся на своём месте внутри него.
  if (from === to) {
    const word = state.wordAt(from)
    if (word) {
      from = word.from
      to = word.to
    }
  }

  if (from === to) {
    return {
      changes: [{ from, to, insert: `${marker}${marker}` }],
      selection: { anchor: from + marker.length },
    }
  }

  const text = state.sliceDoc(from, to)
  const cursorInsideWord = range.empty

  return {
    changes: [{ from, to, insert: `${marker}${text}${marker}` }],
    selection: cursorInsideWord
      ? { anchor: range.head + marker.length }
      : {
          anchor: from + marker.length,
          head: to + marker.length,
        },
  }
}

export function createInlineMarkdownCommand(marker: string) {
  return (view: EditorViewLike) => {
    const change = view.state.changeByRange((range) => {
      const result = computeInlineToggle(view.state, range, marker)

      return {
        changes: result.changes,
        range: EditorSelection.range(
          result.selection.anchor,
          result.selection.head ?? result.selection.anchor,
        ),
      }
    })

    view.dispatch(
      view.state.update(change, {
        scrollIntoView: true,
        userEvent: 'input',
      }),
    )

    return true
  }
}

// Оборачивает выделение (или слово под курсором) в markdown-ссылку. Курсор
// встаёт в скобки url, а при пустом тексте — в квадратные скобки.
export function insertMarkdownLink(view: EditorViewLike) {
  const change = view.state.changeByRange((range) => {
    let { from, to } = range

    if (from === to) {
      const word = view.state.wordAt(from)
      if (word) {
        from = word.from
        to = word.to
      }
    }

    const text = view.state.sliceDoc(from, to)
    const insert = `[${text}]()`
    const cursor = from + (text ? insert.length - 1 : 1)

    return {
      changes: { from, to, insert },
      range: EditorSelection.cursor(cursor),
    }
  })

  view.dispatch(
    view.state.update(change, {
      scrollIntoView: true,
      userEvent: 'input',
    }),
  )

  return true
}

export const markdownShortcuts: KeyBinding[] = [
  {
    key: 'Mod-b',
    run: createInlineMarkdownCommand('**'),
  },
  {
    key: 'Mod-i',
    run: createInlineMarkdownCommand('*'),
  },
  {
    key: 'Mod-e',
    run: createInlineMarkdownCommand('`'),
  },
  {
    key: 'Mod-k',
    run: insertMarkdownLink,
  },
  {
    key: 'Mod-Shift-s',
    run: createInlineMarkdownCommand('~~'),
  },
  {
    key: 'Mod-Shift-h',
    run: createInlineMarkdownCommand('=='),
  },
]
