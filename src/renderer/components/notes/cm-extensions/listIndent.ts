import type {
  ChangeSpec,
  EditorState,
  Line,
  TransactionSpec,
} from '@codemirror/state'
import type { KeyBinding } from '@codemirror/view'
import {
  indentUnit as indentUnitFacet,
  syntaxTree,
} from '@codemirror/language'

interface NodeRange {
  from: number
  to: number
}

interface TableCell {
  from: number
  to: number
  contentFrom: number
  contentTo: number
}

interface TableInfo {
  from: number
  to: number
  cells: TableCell[]
  columnCount: number
}

interface ListIndentOptions {
  indent?: string
}

const orderedRe = /^([ \t]*)(\d+)(\.)\s/
const listRe = /^([ \t]*)([-*+]|\d+\.)(\s+)/
const codeNodeNames = new Set(['FencedCode', 'CodeBlock'])

function getIndentUnit(
  state: EditorState,
  options: ListIndentOptions = {},
): string {
  if (options.indent !== undefined)
    return options.indent

  return state.facet(indentUnitFacet) || '  '
}

function leadingWhitespace(text: string): string {
  return text.match(/^[ \t]*/)?.[0] ?? ''
}

function outdentedIndent(indent: string, unit: string): string {
  if (!indent)
    return indent

  if (indent.endsWith(unit))
    return indent.slice(0, -unit.length)

  if (/^ +$/.test(unit) && /^ +$/.test(indent)) {
    return indent.slice(0, Math.max(0, indent.length - unit.length))
  }

  return indent.slice(0, -1)
}

function getNodeRanges(state: EditorState, names: Set<string>): NodeRange[] {
  const ranges: NodeRange[] = []

  syntaxTree(state).iterate({
    enter(node) {
      if (names.has(node.name)) {
        ranges.push({ from: node.from, to: node.to })
      }
    },
  })

  return ranges
}

function lineIntersectsRanges(line: Line, ranges: NodeRange[]): boolean {
  return ranges.some(range => line.from <= range.to && line.to >= range.from)
}

function getTouchedLineNumbers(state: EditorState): number[] {
  const lineNumbers = new Set<number>()

  for (const range of state.selection.ranges) {
    const fromLine = state.doc.lineAt(range.from).number
    const toPos = range.empty ? range.to : Math.max(range.from, range.to - 1)
    const toLine = state.doc.lineAt(toPos).number

    for (let lineNumber = fromLine; lineNumber <= toLine; lineNumber++) {
      lineNumbers.add(lineNumber)
    }
  }

  return [...lineNumbers].sort((a, b) => a - b)
}

function selectionTouchesSingleLine(state: EditorState): boolean {
  return state.selection.ranges.every((range) => {
    const fromLine = state.doc.lineAt(range.from).number
    const toPos = range.empty ? range.to : Math.max(range.from, range.to - 1)
    return state.doc.lineAt(toPos).number === fromLine
  })
}

function getListItemSubtreeLineNumbers(
  state: EditorState,
  rootLineNumber: number,
): number[] {
  const rootLine = state.doc.line(rootLineNumber)
  const rootMatch = rootLine.text.match(listRe)
  if (!rootMatch)
    return []

  const lineNumbers = [rootLineNumber]
  const rootIndentLength = rootMatch[1].length

  for (
    let lineNumber = rootLineNumber + 1;
    lineNumber <= state.doc.lines;
    lineNumber++
  ) {
    const line = state.doc.line(lineNumber)
    const match = line.text.match(listRe)
    const indentLength = leadingWhitespace(line.text).length

    if (line.text.trim() === '')
      break

    if (match && match[1].length <= rootIndentLength)
      break

    if (!match && line.text.trim() !== '' && indentLength <= rootIndentLength)
      break

    lineNumbers.push(lineNumber)
  }

  return lineNumbers
}

function canOutdentLine(line: Line, unit: string): boolean {
  return leadingWhitespace(line.text).length > 0 && line.text.startsWith(unit)
}

function getOutdentChange(line: Line, unit: string): ChangeSpec | null {
  if (!leadingWhitespace(line.text))
    return null

  if (line.text.startsWith(unit)) {
    return {
      from: line.from,
      to: line.from + unit.length,
    }
  }

  if (/^ +$/.test(unit)) {
    const spaces = line.text.match(/^ */)?.[0].length ?? 0
    const remove = Math.min(spaces, unit.length)
    if (remove > 0) {
      return {
        from: line.from,
        to: line.from + remove,
      }
    }
  }

  return null
}

function collectListLineNumbers(
  state: EditorState,
  direction: 'indent' | 'outdent',
  codeRanges: NodeRange[],
  options: ListIndentOptions,
): number[] {
  const touchedLineNumbers = getTouchedLineNumbers(state)
  const singleTouchedLine = selectionTouchesSingleLine(state)
  const unit = getIndentUnit(state, options)
  const lineNumbers = new Set<number>()

  for (const lineNumber of touchedLineNumbers) {
    const line = state.doc.line(lineNumber)
    if (lineIntersectsRanges(line, codeRanges))
      continue

    if (!listRe.test(line.text))
      continue

    if (singleTouchedLine) {
      if (direction === 'outdent' && !canOutdentLine(line, unit))
        continue

      for (const subtreeLineNumber of getListItemSubtreeLineNumbers(
        state,
        lineNumber,
      )) {
        lineNumbers.add(subtreeLineNumber)
      }
    }
    else {
      lineNumbers.add(lineNumber)
    }
  }

  return [...lineNumbers].sort((a, b) => a - b)
}

function createLineIndentChanges(
  state: EditorState,
  lineNumbers: number[],
  direction: 'indent' | 'outdent',
  options: ListIndentOptions,
): ChangeSpec[] {
  const unit = getIndentUnit(state, options)
  const changes: ChangeSpec[] = []

  for (const lineNumber of lineNumbers) {
    const line = state.doc.line(lineNumber)

    if (direction === 'indent') {
      changes.push({ from: line.from, insert: unit })
      continue
    }

    const change = getOutdentChange(line, unit)
    if (change)
      changes.push(change)
  }

  return changes
}

function createIndentTransactionSpec(
  state: EditorState,
  changes: ChangeSpec[],
  userEvent = 'input.indent',
): TransactionSpec {
  const transaction = state.update({ changes })

  return {
    changes,
    selection: state.selection.map(transaction.changes, 1),
    userEvent,
  }
}

function isListLine(text: string): boolean {
  return listRe.test(text)
}

function getNextOrderedNumberBeforeLine(
  state: EditorState,
  lineNumber: number,
  indent: string,
): number {
  for (let current = lineNumber - 1; current >= 1; current--) {
    const line = state.doc.line(current)
    if (line.text.trim() === '')
      break

    const listMatch = line.text.match(listRe)
    if (!listMatch) {
      if (!/^\s/.test(line.text))
        break

      continue
    }

    if (listMatch[1] !== indent)
      continue

    const ordered = line.text.match(orderedRe)
    if (ordered)
      return Number(ordered[2]) + 1
  }

  return 1
}

function expandListBlock(state: EditorState, lineNumbers: number[]): number[] {
  const blockLineNumbers = new Set<number>()

  for (const lineNumber of lineNumbers) {
    let start = lineNumber
    while (start > 1 && isListLine(state.doc.line(start - 1).text)) {
      start--
    }

    let end = lineNumber
    while (end < state.doc.lines && isListLine(state.doc.line(end + 1).text)) {
      end++
    }

    for (let current = start; current <= end; current++) {
      blockLineNumbers.add(current)
    }
  }

  return [...blockLineNumbers].sort((a, b) => a - b)
}

function createOrderedListRenumberChanges(
  state: EditorState,
  affectedLineNumbers: number[],
  direction: 'indent' | 'outdent',
): ChangeSpec[] {
  const changes: ChangeSpec[] = []
  const countsByIndent = new Map<string, number>()
  const affectedLines = new Set(affectedLineNumbers)

  for (const lineNumber of expandListBlock(state, affectedLineNumbers)) {
    const line = state.doc.line(lineNumber)
    const listMatch = line.text.match(listRe)
    if (!listMatch)
      continue

    const indent = listMatch[1]
    for (const existingIndent of [...countsByIndent.keys()]) {
      if (existingIndent.length > indent.length) {
        countsByIndent.delete(existingIndent)
      }
    }

    const ordered = line.text.match(orderedRe)
    if (!ordered)
      continue

    const currentCount = countsByIndent.get(indent)
    const nextNumber
      = currentCount === undefined
        ? direction === 'indent' && affectedLines.has(lineNumber)
          ? 1
          : Number(ordered[2])
        : currentCount + 1
    countsByIndent.set(indent, nextNumber)

    if (Number(ordered[2]) === nextNumber)
      continue

    changes.push({
      from: line.from + indent.length,
      to: line.from + indent.length + ordered[2].length,
      insert: String(nextNumber),
    })
  }

  return changes
}

function createListIndentSpecs(
  state: EditorState,
  direction: 'indent' | 'outdent',
  options: ListIndentOptions,
): TransactionSpec[] | null {
  const codeRanges = getNodeRanges(state, codeNodeNames)
  const lineNumbers = collectListLineNumbers(
    state,
    direction,
    codeRanges,
    options,
  )
  if (lineNumbers.length === 0)
    return null

  const changes = createLineIndentChanges(
    state,
    lineNumbers,
    direction,
    options,
  )
  if (changes.length === 0)
    return []

  const firstSpec = createIndentTransactionSpec(state, changes)
  const nextState = state.update(firstSpec).state
  const renumberChanges = createOrderedListRenumberChanges(
    nextState,
    lineNumbers,
    direction,
  )

  if (renumberChanges.length === 0)
    return [firstSpec]

  return [
    firstSpec,
    {
      changes: renumberChanges,
      sequential: true,
      userEvent: 'input.indent',
    },
  ]
}

function parseTableCells(line: Line): TableCell[] {
  const pipeIndexes: number[] = []

  for (let index = 0; index < line.text.length; index++) {
    if (line.text[index] === '|') {
      pipeIndexes.push(index)
    }
  }

  if (pipeIndexes.length === 0)
    return []

  const firstContentIndex = line.text.search(/\S/)
  if (firstContentIndex === -1)
    return []

  const lastContentIndex = line.text.search(/\s*$/)
  const startsWithPipe = line.text[firstContentIndex] === '|'
  const endsWithPipe = line.text[lastContentIndex - 1] === '|'
  const cells: TableCell[] = []

  let cellStart = startsWithPipe ? pipeIndexes[0] + 1 : firstContentIndex
  const startPipeIndex = startsWithPipe ? 1 : 0

  for (let index = startPipeIndex; index < pipeIndexes.length; index++) {
    cells.push(createTableCell(line, cellStart, pipeIndexes[index]))
    cellStart = pipeIndexes[index] + 1
  }

  if (!endsWithPipe) {
    cells.push(createTableCell(line, cellStart, lastContentIndex))
  }

  return cells
}

function createTableCell(
  line: Line,
  fromIndex: number,
  toIndex: number,
): TableCell {
  const from = line.from + fromIndex
  const to = line.from + toIndex
  let contentFrom = from
  let contentTo = to

  while (contentFrom < contentTo && stateChar(line, contentFrom) === ' ') {
    contentFrom++
  }
  while (contentTo > contentFrom && stateChar(line, contentTo - 1) === ' ') {
    contentTo--
  }

  return { from, to, contentFrom, contentTo }
}

function stateChar(line: Line, absolutePosition: number): string {
  return line.text[absolutePosition - line.from] ?? ''
}

function isTableDelimiterLine(line: Line): boolean {
  const cells = parseTableCells(line)
  return (
    cells.length > 0
    && cells.every(cell =>
      /^:?-{3,}:?$/.test(
        line.text.slice(cell.from - line.from, cell.to - line.from).trim(),
      ),
    )
  )
}

function getTables(state: EditorState): TableInfo[] {
  const tables: TableInfo[] = []

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== 'Table')
        return

      const cells: TableCell[] = []
      let columnCount = 0
      const startLine = state.doc.lineAt(node.from).number
      const endLine = state.doc.lineAt(Math.max(node.to - 1, node.from)).number

      for (let lineNumber = startLine; lineNumber <= endLine; lineNumber++) {
        const line = state.doc.line(lineNumber)
        const lineCells = parseTableCells(line)
        if (lineCells.length === 0 || isTableDelimiterLine(line))
          continue

        if (columnCount === 0)
          columnCount = lineCells.length

        cells.push(...lineCells)
      }

      tables.push({
        from: node.from,
        to: node.to,
        cells,
        columnCount,
      })
    },
  })

  return tables
}

function createEmptyTableRow(columnCount: number): string {
  return `\n| ${Array.from({ length: columnCount }).fill('').join(' | ')} |`
}

function createTableNavigationSpec(
  state: EditorState,
  direction: 'next' | 'previous',
): TransactionSpec | null {
  if (state.selection.ranges.length !== 1 || !state.selection.main.empty)
    return null

  const head = state.selection.main.head
  const table = getTables(state).find(
    table => head >= table.from && head <= table.to,
  )
  if (!table || table.cells.length === 0)
    return null

  const cellIndex = table.cells.findIndex(
    cell => head >= cell.from && head <= cell.to,
  )
  if (cellIndex === -1)
    return null

  if (direction === 'previous') {
    const previous = table.cells[cellIndex - 1]
    if (!previous)
      return { selection: { anchor: table.cells[0].contentFrom } }

    return { selection: { anchor: previous.contentFrom } }
  }

  const next = table.cells[cellIndex + 1]
  if (next)
    return { selection: { anchor: next.contentFrom } }

  const row = createEmptyTableRow(table.columnCount)
  return {
    changes: { from: table.to, insert: row },
    selection: { anchor: table.to + 3 },
    userEvent: 'input',
  }
}

function createFallbackIndentSpecs(
  state: EditorState,
  direction: 'indent' | 'outdent',
  options: ListIndentOptions,
): TransactionSpec[] {
  const unit = getIndentUnit(state, options)
  const touchedLineNumbers = getTouchedLineNumbers(state)
  const multilineSelection = touchedLineNumbers.length > 1
  const codeRanges = getNodeRanges(state, codeNodeNames)
  const touchesOnlyCodeLines = touchedLineNumbers.every(lineNumber =>
    lineIntersectsRanges(state.doc.line(lineNumber), codeRanges),
  )

  if (direction === 'indent' && !multilineSelection && touchesOnlyCodeLines) {
    return [
      {
        changes: state.selection.ranges.map(range => ({
          from: range.from,
          to: range.to,
          insert: unit,
        })),
        userEvent: 'input.indent',
      },
    ]
  }

  const changes
    = direction === 'indent'
      ? createLineIndentChanges(state, touchedLineNumbers, 'indent', options)
      : createLineIndentChanges(state, touchedLineNumbers, 'outdent', options)

  if (changes.length === 0)
    return []

  return [createIndentTransactionSpec(state, changes)]
}

function runTabCommand(
  view: Parameters<NonNullable<KeyBinding['run']>>[0],
  direction: 'indent' | 'outdent',
  options: ListIndentOptions,
): boolean {
  const tableSpec = createTableNavigationSpec(
    view.state,
    direction === 'indent' ? 'next' : 'previous',
  )
  if (tableSpec) {
    view.dispatch(tableSpec)
    return true
  }

  const listSpecs = createListIndentSpecs(view.state, direction, options)
  if (listSpecs) {
    if (listSpecs.length > 0)
      view.dispatch(...listSpecs)

    return true
  }

  const fallbackSpecs = createFallbackIndentSpecs(
    view.state,
    direction,
    options,
  )
  if (fallbackSpecs.length > 0)
    view.dispatch(...fallbackSpecs)

  return true
}

export function createListIndent(
  options: ListIndentOptions = {},
): KeyBinding[] {
  return [
    {
      key: 'Tab',
      run(view) {
        return runTabCommand(view, 'indent', options)
      },
    },
    {
      key: 'Shift-Tab',
      run(view) {
        return runTabCommand(view, 'outdent', options)
      },
    },
    {
      key: 'Enter',
      run(view) {
        const { state } = view

        if (state.selection.ranges.length !== 1)
          return false

        const range = state.selection.main
        if (!range.empty)
          return false

        const currentLine = state.doc.lineAt(range.head)

        let firstLine: { from: number, text: string, number: number } | null
          = null

        if (listRe.test(currentLine.text)) {
          firstLine = currentLine
        }
        else if (/^\s/.test(currentLine.text)) {
          for (let ln = currentLine.number - 1; ln >= 1; ln--) {
            const prevLine = state.doc.line(ln)
            if (listRe.test(prevLine.text)) {
              firstLine = prevLine
              break
            }
            if (!/^\s/.test(prevLine.text) && prevLine.text !== '')
              break
            if (prevLine.text === '')
              break
          }
        }

        if (!firstLine)
          return false

        const match = firstLine.text.match(listRe)!

        if (
          currentLine.number === firstLine.number
          && range.head < firstLine.from + match[0].length
        ) {
          return false
        }

        const [full, indent, marker] = match
        const afterMarker = firstLine.text.slice(full.length)
        const taskMatch = afterMarker.match(/^\[[ x]\]\s/i)
        const hasTask = !!taskMatch
        const taskPrefixLen = hasTask ? taskMatch![0].length : 0

        const contentAfter = afterMarker.slice(taskPrefixLen).trim()
        const onFirstLine = currentLine.number === firstLine.number

        if (onFirstLine && contentAfter === '') {
          const parentIndent = outdentedIndent(
            indent,
            getIndentUnit(state, options),
          )

          if (parentIndent !== indent) {
            const orderedMatch = marker.match(/^(\d+)\.$/)
            const liftedMarker = orderedMatch
              ? `${getNextOrderedNumberBeforeLine(
                state,
                firstLine.number,
                parentIndent,
              )}.`
              : marker
            const taskSuffix = hasTask ? '[ ] ' : ''
            const replacement = `${parentIndent}${liftedMarker} ${taskSuffix}`
            const firstSpec: TransactionSpec = {
              changes: {
                from: firstLine.from,
                to: firstLine.from + full.length + taskPrefixLen,
                insert: replacement,
              },
              selection: { anchor: firstLine.from + replacement.length },
              scrollIntoView: true,
              userEvent: 'input',
            }

            if (!orderedMatch) {
              view.dispatch(firstSpec)
              return true
            }

            const nextState = state.update(firstSpec).state
            const renumberChanges = createOrderedListRenumberChanges(
              nextState,
              [firstLine.number],
              'outdent',
            )

            if (renumberChanges.length === 0) {
              view.dispatch(firstSpec)
              return true
            }

            view.dispatch(firstSpec, {
              changes: renumberChanges,
              sequential: true,
              userEvent: 'input',
            })
            return true
          }

          view.dispatch({
            changes: {
              from: firstLine.from,
              to: firstLine.from + full.length + taskPrefixLen,
              insert: '',
            },
            selection: { anchor: firstLine.from },
            scrollIntoView: true,
            userEvent: 'input',
          })
          return true
        }

        const orderedMatch = marker.match(/^(\d+)\.$/)
        const nextMarker = orderedMatch
          ? `${Number(orderedMatch[1]) + 1}.`
          : marker
        const taskSuffix = hasTask ? '[ ] ' : ''
        const nextPrefix = `${indent}${nextMarker} ${taskSuffix}`
        const insert = `\n${nextPrefix}`

        view.dispatch({
          changes: { from: range.from, to: range.to, insert },
          selection: { anchor: range.from + insert.length },
          scrollIntoView: true,
          userEvent: 'input',
        })
        return true
      },
    },
    {
      key: 'Shift-Enter',
      run(view) {
        const { state } = view

        if (state.selection.ranges.length !== 1)
          return false

        const range = state.selection.main
        if (!range.empty)
          return false

        const line = state.doc.lineAt(range.head)
        const match = line.text.match(listRe)
        if (!match)
          return false

        if (range.head < line.from + match[0].length)
          return false

        const insert = `\n${' '.repeat(match[0].length)}`

        view.dispatch({
          changes: { from: range.from, to: range.to, insert },
          selection: { anchor: range.from + insert.length },
          scrollIntoView: true,
          userEvent: 'input',
        })
        return true
      },
    },
  ]
}

export const listIndent: KeyBinding[] = createListIndent()
