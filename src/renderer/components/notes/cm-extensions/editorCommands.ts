import type { ChangeSpec } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { EditorSelection } from '@codemirror/state'
import { createInlineMarkdownCommand } from './markdownShortcuts'

// Команды редактора заметок, общие для контекстного меню и (в перспективе)
// хоткеев/тулбара. Каждая функция принимает EditorView, мутирует документ
// через dispatch и возвращает фокус в редактор.

// --- Inline-форматирование -------------------------------------------------

// Переиспользуем существующую логику toggle-обёртки из markdownShortcuts,
// чтобы не дублировать поведение (вставка пары маркеров на пустом выделении,
// снятие маркеров при повторном применении).
function toggleInline(view: EditorView, marker: string) {
  createInlineMarkdownCommand(marker)(view)
  view.focus()
}

export function toggleBold(view: EditorView) {
  toggleInline(view, '**')
}

export function toggleItalic(view: EditorView) {
  toggleInline(view, '*')
}

export function toggleStrikethrough(view: EditorView) {
  toggleInline(view, '~~')
}

export function toggleHighlight(view: EditorView) {
  toggleInline(view, '==')
}

export function toggleInlineCode(view: EditorView) {
  toggleInline(view, '`')
}

export function clearInlineFormatting(view: EditorView) {
  const { state } = view
  const main = state.selection.main

  if (main.empty) {
    view.focus()
    return
  }

  const text = state.doc.sliceString(main.from, main.to)
  const cleaned = text
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/~~/g, '')
    .replace(/==/g, '')
    .replace(/[*_`]/g, '')

  if (cleaned !== text) {
    view.dispatch(
      state.update({
        changes: { from: main.from, to: main.to, insert: cleaned },
        selection: EditorSelection.range(main.from, main.from + cleaned.length),
        scrollIntoView: true,
        userEvent: 'input',
      }),
    )
  }

  view.focus()
}

// --- Помощники для построчных команд --------------------------------------

interface DocLine {
  from: number
  to: number
  text: string
}

function getSelectedLines(view: EditorView): DocLine[] {
  const { state } = view
  const main = state.selection.main
  const startLine = state.doc.lineAt(main.from).number
  const endLine = state.doc.lineAt(main.to).number
  const lines: DocLine[] = []

  for (let number = startLine; number <= endLine; number++) {
    const line = state.doc.line(number)
    lines.push({ from: line.from, to: line.to, text: line.text })
  }

  return lines
}

function dispatchLineChanges(view: EditorView, changes: ChangeSpec[]) {
  if (changes.length) {
    view.dispatch(
      view.state.update({
        changes,
        scrollIntoView: true,
        userEvent: 'input',
      }),
    )
  }

  view.focus()
}

function splitIndent(text: string): [string, string] {
  const match = text.match(/^\s*/)
  const indent = match ? match[0] : ''
  return [indent, text.slice(indent.length)]
}

function isBlank(text: string) {
  return text.trim() === ''
}

// Любой list-маркер (bullet / task / ordered) — для чистого переключения
// между типами списков.
const ANY_LIST_PREFIX = /^(\s*)(?:[-*+] (?:\[[ x]\] )?|\d+\.\s)/i

// --- Списки ----------------------------------------------------------------

const BULLET_RE = /^\s*[-*+] (?!\[[ x]\])/i
const TASK_RE = /^\s*[-*+] \[[ x]\] /i
const ORDERED_RE = /^\s*\d+\.\s/

function targetLines(lines: DocLine[]): DocLine[] {
  const nonBlank = lines.filter(line => !isBlank(line.text))
  return nonBlank.length ? nonBlank : lines
}

export function toggleBulletList(view: EditorView) {
  const lines = getSelectedLines(view)
  const allMatch = targetLines(lines).every(line =>
    BULLET_RE.test(line.text),
  )
  const changes: ChangeSpec[] = []

  for (const line of lines) {
    if (isBlank(line.text) && !allMatch)
      continue

    let next: string
    if (allMatch) {
      next = line.text.replace(ANY_LIST_PREFIX, '$1')
    }
    else {
      const [indent, rest] = splitIndent(
        line.text.replace(ANY_LIST_PREFIX, '$1'),
      )
      next = `${indent}- ${rest}`
    }

    if (next !== line.text)
      changes.push({ from: line.from, to: line.to, insert: next })
  }

  dispatchLineChanges(view, changes)
}

export function toggleTaskList(view: EditorView) {
  const lines = getSelectedLines(view)
  const allMatch = targetLines(lines).every(line => TASK_RE.test(line.text))
  const changes: ChangeSpec[] = []

  for (const line of lines) {
    if (isBlank(line.text) && !allMatch)
      continue

    let next: string
    if (allMatch) {
      next = line.text.replace(ANY_LIST_PREFIX, '$1')
    }
    else {
      const [indent, rest] = splitIndent(
        line.text.replace(ANY_LIST_PREFIX, '$1'),
      )
      next = `${indent}- [ ] ${rest}`
    }

    if (next !== line.text)
      changes.push({ from: line.from, to: line.to, insert: next })
  }

  dispatchLineChanges(view, changes)
}

export function toggleOrderedList(view: EditorView) {
  const lines = getSelectedLines(view)
  const allMatch = targetLines(lines).every(line =>
    ORDERED_RE.test(line.text),
  )
  const changes: ChangeSpec[] = []
  let index = 1

  for (const line of lines) {
    if (isBlank(line.text) && !allMatch)
      continue

    let next: string
    if (allMatch) {
      next = line.text.replace(ANY_LIST_PREFIX, '$1')
    }
    else {
      const [indent, rest] = splitIndent(
        line.text.replace(ANY_LIST_PREFIX, '$1'),
      )
      next = `${indent}${index}. ${rest}`
      index += 1
    }

    if (next !== line.text)
      changes.push({ from: line.from, to: line.to, insert: next })
  }

  dispatchLineChanges(view, changes)
}

// --- Заголовки и абзацы ----------------------------------------------------

const HEADING_RE = /^(#{1,6}) +/

export function getHeadingLevel(view: EditorView): number {
  const { state } = view
  const line = state.doc.lineAt(state.selection.main.from)
  const match = line.text.match(HEADING_RE)
  return match ? match[1].length : 0
}

export function setHeading(view: EditorView, level: number) {
  const lines = getSelectedLines(view)
  const hashes = '#'.repeat(level)
  const allSame = targetLines(lines).every((line) => {
    const match = line.text.match(HEADING_RE)
    return match !== null && match[1].length === level
  })
  const changes: ChangeSpec[] = []

  for (const line of lines) {
    if (isBlank(line.text) && !allSame)
      continue

    const stripped = line.text.replace(HEADING_RE, '')
    const next = allSame ? stripped : `${hashes} ${stripped}`

    if (next !== line.text)
      changes.push({ from: line.from, to: line.to, insert: next })
  }

  dispatchLineChanges(view, changes)
}

export function setBody(view: EditorView) {
  const lines = getSelectedLines(view)
  const changes: ChangeSpec[] = []

  for (const line of lines) {
    const next = line.text.replace(HEADING_RE, '')
    if (next !== line.text)
      changes.push({ from: line.from, to: line.to, insert: next })
  }

  dispatchLineChanges(view, changes)
}

const QUOTE_RE = /^(\s*)> ?/

export function toggleQuote(view: EditorView) {
  const lines = getSelectedLines(view)
  const allMatch = targetLines(lines).every(line => QUOTE_RE.test(line.text))
  const changes: ChangeSpec[] = []

  for (const line of lines) {
    if (isBlank(line.text) && !allMatch)
      continue

    let next: string
    if (allMatch) {
      next = line.text.replace(QUOTE_RE, '$1')
    }
    else {
      const [indent, rest] = splitIndent(line.text)
      next = `${indent}> ${rest}`
    }

    if (next !== line.text)
      changes.push({ from: line.from, to: line.to, insert: next })
  }

  dispatchLineChanges(view, changes)
}

// --- Вставка блоков --------------------------------------------------------

// Вставляет блок на отдельных строках в позиции выделения, добавляя
// переносы строк только когда их ещё нет. cursorOffset задаёт позицию
// курсора внутри сниппета (по умолчанию — конец блока).
function insertBlock(view: EditorView, snippet: string, cursorOffset?: number) {
  const { state } = view
  const main = state.selection.main

  const charBefore
    = main.from > 0 ? state.doc.sliceString(main.from - 1, main.from) : '\n'
  const charAfter
    = main.to < state.doc.length
      ? state.doc.sliceString(main.to, main.to + 1)
      : '\n'

  const lead = charBefore === '\n' ? '' : '\n'
  const trail = charAfter === '\n' ? '' : '\n'
  const insert = `${lead}${snippet}${trail}`
  const cursor = main.from + lead.length + (cursorOffset ?? snippet.length)

  view.dispatch(
    state.update({
      changes: { from: main.from, to: main.to, insert },
      selection: EditorSelection.cursor(cursor),
      scrollIntoView: true,
      userEvent: 'input',
    }),
  )

  view.focus()
}

export function insertTable(view: EditorView) {
  const snippet
    = '| Column | Column |\n| --- | --- |\n| Cell | Cell |\n| Cell | Cell |'
  insertBlock(view, snippet)
}

export function insertCallout(view: EditorView) {
  // Курсор после `> ` на строке заголовка.
  insertBlock(view, '> [!NOTE] Title\n> ', undefined)
}

export function insertHorizontalRule(view: EditorView) {
  insertBlock(view, '---')
}

export function insertCodeBlock(view: EditorView) {
  // Курсор на пустой строке между ограждениями (после "```\n").
  insertBlock(view, '```\n\n```', 4)
}
