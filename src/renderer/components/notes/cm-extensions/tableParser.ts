export interface ParsedMarkdownTable {
  header: string[]
  rows: string[][]
}

export interface TableModel {
  header: string[]
  delimiters: string[]
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
