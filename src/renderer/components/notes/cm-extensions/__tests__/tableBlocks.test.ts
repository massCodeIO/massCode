import { describe, expect, it } from 'vitest'
import {
  isTableDelimiterCell,
  parseMarkdownTable,
  parseTableRow,
} from '../tableBlocks'

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
})
