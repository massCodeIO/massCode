import type { SearchText } from '../searchDocument'
import { describe, expect, it } from 'vitest'
import { normalizeSearchText, searchTextIncludes } from '../searchDocument'
import {
  buildSearchIndex,
  querySearchIndex,
  updateSearchIndexItem,
} from '../searchEngine'
import { normalizeSearchValue } from '../searchIndex'

describe.each([' ', '\n'] as const)(
  'segmented search with %j separator',
  (separator) => {
    const documents = [
      ['Hello', '', 'World', 'tail'],
      ['ΟΣ', 'ΟΣΑ', 'Café', 're\u0301sume\u0301'],
      ['Привет', '世界', '🚀', 'İSTANBUL'],
      ['', '', '', ''],
      [],
      ['a', 'b', 'c', 'd', 'e'],
      ['x'.repeat(4000), 'boundary', 'y'.repeat(4000)],
    ]

    it('matches joined normalization for substrings crossing multiple boundaries', () => {
      for (const parts of documents) {
        const joined = normalizeSearchValue(parts.join(separator))
        const text = normalizeSearchText({ parts, separator })
        const queries = [
          '',
          'missing',
          'hello world',
          'café',
          'ΟΣ',
          '🚀',
          'a',
          separator,
        ]
        for (
          let start = 0;
          start < joined.length;
          start += Math.max(1, Math.floor(joined.length / 80))
        ) {
          for (const length of [1, 2, 3, 7, 20, 100])
            queries.push(joined.slice(start, start + length))
        }
        for (const query of queries) {
          const normalized = normalizeSearchValue(query)
          expect(
            searchTextIncludes(text, normalized),
            JSON.stringify({ parts: parts.map(p => p.slice(0, 30)), query }),
          ).toBe(joined.includes(normalized))
        }
      }
    })

    it('preserves indexed results and invalidation after changing parts', () => {
      const items = documents.map((parts, id) => ({ id, parts }))
      const getText = (item: (typeof items)[number]): SearchText => ({
        parts: item.parts,
        separator,
      })
      const index = buildSearchIndex(items, getText)
      const queries = [
        'hello',
        'world',
        ['hello', '', 'world'].join(separator),
        ['a', 'b', 'c', 'd'].join(separator),
        'café',
        '世界',
        '🚀',
        'ΟΣ',
        'missing',
      ]
      const check = () => {
        for (const query of queries) {
          const normalized = normalizeSearchValue(query).trim()
          const expected = new Set(
            items
              .filter(item =>
                normalizeSearchValue(item.parts.join(separator)).includes(
                  normalized,
                ),
              )
              .map(item => item.id),
          )
          expect(querySearchIndex(items, query, index, getText)).toEqual(
            expected,
          )
          expect(querySearchIndex(items, query, null, getText)).toEqual(
            expected,
          )
        }
      }
      check()
      items[0].parts[0] = 'updated'
      items[0].parts[2] = 'missing'
      updateSearchIndexItem(index, 0, getText(items[0]))
      check()
      expect(index.tokenToIds.has('g:hel')).toBe(false)
    })
  },
)
