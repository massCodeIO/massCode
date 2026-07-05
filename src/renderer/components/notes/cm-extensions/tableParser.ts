export interface ParsedMarkdownTable {
  header: string[]
  rows: string[][]
}

export interface TableModel {
  header: string[]
  delimiters: string[]
  rows: string[][]
}

// Ячейки возвращаются в экранированной форме (как в исходнике): `\|` из
// escapeCell — содержимое ячейки, а не разделитель колонок.
export function parseTableRow(line: string): string[] {
  const trimmed = line.trim()
  if (!trimmed.includes('|'))
    return []

  const cells: string[] = []
  let current = ''
  let closedByPipe = false

  for (let i = trimmed.startsWith('|') ? 1 : 0; i < trimmed.length; i++) {
    const char = trimmed[i]

    if (char === '\\' && trimmed[i + 1] === '|') {
      current += '\\|'
      i += 1
      closedByPipe = false
      continue
    }

    if (char === '|') {
      cells.push(current.trim())
      current = ''
      closedByPipe = true
      continue
    }

    current += char
    closedByPipe = false
  }

  // Хвост после последнего `|` — ячейка строки без закрывающего пайпа.
  if (!closedByPipe)
    cells.push(current.trim())

  return cells
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
  // Одна колонка — валидная GFM-таблица (нужна и для удаления столбцов).
  if (header.length < 1 || header.length !== delimiter.length)
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

// Строка-разделитель несёт выравнивание колонок (`:--`, `--:`, `:--:`). Парсер
// таблицы её отбрасывает, поэтому достаём отдельно, чтобы сохранять
// выравнивание при правках.
export function parseDelimiters(source: string, columns: number): string[] {
  const lines = source
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  const delimiter = parseTableRow(lines[1] ?? '')
  if (delimiter.length === columns && delimiter.every(isTableDelimiterCell))
    return delimiter

  return Array.from({ length: columns }, () => '---')
}

export type TableColumnAlignment = 'left' | 'center' | 'right'

export function delimiterAlignment(delimiter: string): TableColumnAlignment {
  const trimmed = delimiter.trim()
  const left = trimmed.startsWith(':')
  const right = trimmed.endsWith(':')

  if (left && right)
    return 'center'
  if (right)
    return 'right'

  return 'left'
}

export function escapeCell(value: string): string {
  return value
    .replace(/[\r\n]+/g, ' ')
    .replace(/\|/g, '\\|')
    .trim()
}

export function unescapeCell(value: string): string {
  return value.replace(/\\\|/g, '|')
}

export function serializeTable(model: TableModel): string {
  const row = (cells: string[]) => `| ${cells.map(escapeCell).join(' | ')} |`
  return [
    row(model.header),
    `| ${model.delimiters.join(' | ')} |`,
    ...model.rows.map(row),
  ].join('\n')
}

export function insertTableRow(model: TableModel, index: number): TableModel {
  const rows = [...model.rows]
  const clamped = Math.max(0, Math.min(index, rows.length))
  rows.splice(
    clamped,
    0,
    Array.from({ length: model.header.length }, () => ''),
  )

  return { ...model, rows }
}

export function removeTableRow(model: TableModel, index: number): TableModel {
  if (index < 0 || index >= model.rows.length)
    return model

  const rows = [...model.rows]
  rows.splice(index, 1)

  return { ...model, rows }
}

export function insertTableColumn(
  model: TableModel,
  index: number,
): TableModel {
  const clamped = Math.max(0, Math.min(index, model.header.length))
  const insertAt = <T>(items: T[], value: T): T[] => {
    const next = [...items]
    next.splice(clamped, 0, value)
    return next
  }

  return {
    header: insertAt(model.header, ''),
    delimiters: insertAt(model.delimiters, '---'),
    rows: model.rows.map(row => insertAt(row, '')),
  }
}

export function removeTableColumn(
  model: TableModel,
  index: number,
): TableModel {
  if (model.header.length <= 1 || index < 0 || index >= model.header.length)
    return model

  const removeAt = <T>(items: T[]): T[] =>
    items.filter((_, position) => position !== index)

  return {
    header: removeAt(model.header),
    delimiters: removeAt(model.delimiters),
    rows: model.rows.map(row => removeAt(row)),
  }
}

export function setTableColumnAlignment(
  model: TableModel,
  index: number,
  alignment: TableColumnAlignment,
): TableModel {
  if (index < 0 || index >= model.delimiters.length)
    return model

  const delimiters = [...model.delimiters]
  delimiters[index]
    = alignment === 'center' ? ':---:' : alignment === 'right' ? '---:' : '---'

  return { ...model, delimiters }
}

export function moveTableColumn(
  model: TableModel,
  from: number,
  toSlot: number,
): TableModel {
  const columns = model.header.length
  if (
    from < 0
    || toSlot < 0
    || from >= columns
    || toSlot > columns
    || toSlot === from
    || toSlot === from + 1
  ) {
    return model
  }

  const move = <T>(items: T[]): T[] => {
    const next = [...items]
    const [item] = next.splice(from, 1)
    const to = toSlot > from ? toSlot - 1 : toSlot
    next.splice(to, 0, item as T)
    return next
  }

  return {
    header: move(model.header),
    delimiters: move(model.delimiters),
    rows: model.rows.map(row => move(row)),
  }
}

export function moveTableRow(
  model: TableModel,
  from: number,
  toSlot: number,
): TableModel {
  const rowCount = model.rows.length
  if (
    from < 0
    || toSlot < 0
    || from >= rowCount
    || toSlot > rowCount
    || toSlot === from
    || toSlot === from + 1
  ) {
    return model
  }

  const rows = [...model.rows]
  const [row] = rows.splice(from, 1)
  const to = toSlot > from ? toSlot - 1 : toSlot
  rows.splice(to, 0, row as string[])

  return {
    ...model,
    rows,
  }
}
