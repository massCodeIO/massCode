import { describe, expect, it } from 'vitest'
import {
  insertTableColumn,
  insertTableRow,
  isTableDelimiterCell,
  moveTableColumn,
  moveTableRow,
  parseMarkdownTable,
  parseTableRow,
  removeTableColumn,
  removeTableRow,
  setTableColumnAlignment,
} from '../tableParser'

describe('tableBlocks parser', () => {
  it('parses markdown table into header and rows', () => {
    const parsed = parseMarkdownTable(
      [
        '| Entity | Purpose | Status |',
        '| --- | --- | --- |',
        '| Notes | Text notes | Active |',
        '| Tags | Filtering | Active |',
      ].join('\n'),
    )

    expect(parsed).toEqual({
      header: ['Entity', 'Purpose', 'Status'],
      rows: [
        ['Notes', 'Text notes', 'Active'],
        ['Tags', 'Filtering', 'Active'],
      ],
    })
  })

  it('supports delimiter alignment markers', () => {
    expect(isTableDelimiterCell('---')).toBe(true)
    expect(isTableDelimiterCell(':---')).toBe(true)
    expect(isTableDelimiterCell('---:')).toBe(true)
    expect(isTableDelimiterCell(':---:')).toBe(true)
    expect(isTableDelimiterCell('--')).toBe(false)
    expect(isTableDelimiterCell('abc')).toBe(false)
  })

  it('normalizes row parsing with or without edge pipes', () => {
    expect(parseTableRow('| a | b |')).toEqual(['a', 'b'])
    expect(parseTableRow('a | b')).toEqual(['a', 'b'])
    expect(parseTableRow('   | a | b |   ')).toEqual(['a', 'b'])
  })

  it('returns null for invalid table source', () => {
    expect(parseMarkdownTable('just text')).toBeNull()
    expect(parseMarkdownTable('| a |\n| -- |\n| b |')).toBeNull()
    expect(parseMarkdownTable('| a | b |\n| --- |\n| c | d |')).toBeNull()
  })

  it('moves a table column with delimiter and row cells', () => {
    const model = {
      header: ['A', 'B', 'C'],
      delimiters: ['---', ':---:', '---:'],
      rows: [
        ['1', '2', '3'],
        ['4', '5', '6'],
      ],
    }

    expect(moveTableColumn(model, 0, 3)).toEqual({
      header: ['B', 'C', 'A'],
      delimiters: [':---:', '---:', '---'],
      rows: [
        ['2', '3', '1'],
        ['5', '6', '4'],
      ],
    })

    expect(moveTableColumn(model, 2, 1)).toEqual({
      header: ['A', 'C', 'B'],
      delimiters: ['---', '---:', ':---:'],
      rows: [
        ['1', '3', '2'],
        ['4', '6', '5'],
      ],
    })

    expect(moveTableColumn(model, 1, 0)).toEqual({
      header: ['B', 'A', 'C'],
      delimiters: [':---:', '---', '---:'],
      rows: [
        ['2', '1', '3'],
        ['5', '4', '6'],
      ],
    })
  })

  it('moves a table body row to a drop slot', () => {
    const model = {
      header: ['A', 'B'],
      delimiters: ['---', '---'],
      rows: [
        ['1', '2'],
        ['3', '4'],
        ['5', '6'],
      ],
    }

    expect(moveTableRow(model, 2, 1)).toEqual({
      header: ['A', 'B'],
      delimiters: ['---', '---'],
      rows: [
        ['1', '2'],
        ['5', '6'],
        ['3', '4'],
      ],
    })

    expect(moveTableRow(model, 1, 0)).toEqual({
      header: ['A', 'B'],
      delimiters: ['---', '---'],
      rows: [
        ['3', '4'],
        ['1', '2'],
        ['5', '6'],
      ],
    })
  })
})

describe('table model operations', () => {
  const model = {
    header: ['A', 'B'],
    delimiters: ['---', ':---:'],
    rows: [
      ['1', '2'],
      ['3', '4'],
    ],
  }

  it('parses a single column table', () => {
    expect(parseMarkdownTable('| a |\n| --- |\n| b |')).toEqual({
      header: ['a'],
      rows: [['b']],
    })
  })

  it('inserts a row at the given index', () => {
    expect(insertTableRow(model, 1).rows).toEqual([
      ['1', '2'],
      ['', ''],
      ['3', '4'],
    ])
  })

  it('removes a row and keeps the rest', () => {
    expect(removeTableRow(model, 0).rows).toEqual([['3', '4']])
  })

  it('inserts a column with a default delimiter', () => {
    expect(insertTableColumn(model, 1)).toEqual({
      header: ['A', '', 'B'],
      delimiters: ['---', '---', ':---:'],
      rows: [
        ['1', '', '2'],
        ['3', '', '4'],
      ],
    })
  })

  it('removes a column together with its delimiter', () => {
    expect(removeTableColumn(model, 0)).toEqual({
      header: ['B'],
      delimiters: [':---:'],
      rows: [['2'], ['4']],
    })
  })

  it('refuses to remove the last column', () => {
    const single = { header: ['A'], delimiters: ['---'], rows: [['1']] }

    expect(removeTableColumn(single, 0)).toBe(single)
  })

  it('sets column alignment through the delimiter', () => {
    expect(setTableColumnAlignment(model, 0, 'right').delimiters).toEqual([
      '---:',
      ':---:',
    ])
    expect(setTableColumnAlignment(model, 1, 'left').delimiters).toEqual([
      '---',
      '---',
    ])
  })
})
