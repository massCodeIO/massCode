import { describe, expect, it } from 'vitest'
import { parseBulkEntries, serializeBulkEntries } from '../keyValueTable'

describe('key value bulk editing', () => {
  it('parses disabled rows, empty values, CRLF, Unicode and values containing colons', () => {
    expect(
      parseBulkEntries(
        'url:https://example.com:8080\r\n//ключ:значение\r\nempty\n\n:zero',
        [],
      ),
    ).toEqual([
      {
        key: 'url',
        value: 'https://example.com:8080',
        enabled: true,
        description: '',
      },
      { key: 'ключ', value: 'значение', enabled: false, description: '' },
      { key: 'empty', value: '', enabled: true, description: '' },
      { key: '', value: 'zero', enabled: true, description: '' },
    ])
  })

  it('retains duplicate rows and their descriptions when reordering and editing values', () => {
    const entries = [
      { key: 'x', value: 'a', description: 'first', enabled: true },
      { key: 'x', value: 'b', description: 'second', enabled: false },
    ]
    expect(parseBulkEntries('//x:b\nx:changed', entries)).toEqual([
      entries[1],
      { ...entries[0], value: 'changed' },
    ])
    expect(parseBulkEntries(serializeBulkEntries(entries), entries)).toEqual(
      entries,
    )
  })

  it('uses factory defaults for new rows and clears all rows on empty input', () => {
    expect(
      parseBulkEntries('new: value ', [], () => ({
        key: '',
        value: '',
        type: 'text',
      })),
    ).toEqual([
      {
        key: 'new',
        value: ' value ',
        type: 'text',
        enabled: true,
        description: '',
      },
    ])
    expect(parseBulkEntries('', [{ key: 'old', value: 'value' }])).toEqual([])
  })
})
