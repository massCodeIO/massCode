import { describe, expect, it } from 'vitest'
import {
  buildKeywordIndex,
  KEYWORD_SEARCH,
  nameScore,
  removeKeywordDocument,
  searchKeywords,
  updateKeywordDocument,
} from '../keywordIndex'

const documents = [
  {
    ref: 'snippet:1',
    name: 'Staging hosts',
    body: '# Inventory deployment: web and db groups',
  },
  {
    ref: 'snippet:2',
    name: 'Retry with backoff',
    body: 'retry the request, deployment of retries',
  },
  { ref: 'note:1', name: 'Рецепт борща', body: 'Свёкла и капуста' },
]

describe('searchKeywords', () => {
  it('scores coverage over query terms and keeps matched terms', () => {
    const hits = searchKeywords(
      buildKeywordIndex(documents),
      'Inventory deployment',
    )
    expect(hits.get('snippet:1')).toMatchObject({
      coverage: 1,
      matchedTerms: ['inventory', 'deployment'],
    })
    expect(hits.get('snippet:2')?.coverage).toBe(0.5)
    expect(hits.get('snippet:1')!.bm25).toBeGreaterThan(
      hits.get('snippet:2')!.bm25,
    )
  })
  it('stems russian forms and matches the last term as a prefix', () => {
    const index = buildKeywordIndex(documents)
    expect(searchKeywords(index, 'борщ').get('note:1')?.coverage).toBe(1)
    expect(searchKeywords(index, 'рецепты борщ').get('note:1')?.coverage).toBe(
      1,
    )
    expect(searchKeywords(index, 'капус').get('note:1')?.coverage).toBe(1)
    expect(
      searchKeywords(index, 'капус', {
        ...KEYWORD_SEARCH,
        prefixLast: false,
      }).has('note:1'),
    ).toBe(false)
  })
  it('does not lose a word on intermediate prefixes while typing', () => {
    const index = buildKeywordIndex([
      { ref: 'snippet:9', name: 'Helpers', body: 'string helpers for notes' },
    ])
    for (const typed of ['st', 'str', 'stri', 'strin', 'string', 'strings'])
      expect(searchKeywords(index, typed).get('snippet:9')?.coverage).toBe(1)
    expect(searchKeywords(index, 'note').has('snippet:9')).toBe(true)
    expect(
      searchKeywords(index, 'helpers notes').get('snippet:9')?.coverage,
    ).toBe(1)
  })
  it('does not match words by a one-letter query', () => {
    const index = buildKeywordIndex([
      { ref: 'snippet:9', name: 'Notes', body: 'string helpers' },
    ])
    expect(searchKeywords(index, 's').get('snippet:9')?.coverage ?? 0).toBe(0)
  })
  it('keeps the prefix lookup in sync after edits', () => {
    const index = buildKeywordIndex([
      { ref: 'note:7', name: 'A', body: 'alpha' },
    ])
    expect(searchKeywords(index, 'alp').has('note:7')).toBe(true)
    updateKeywordDocument(index, { ref: 'note:8', name: 'B', body: 'alpine' })
    expect([...searchKeywords(index, 'alp').keys()].sort()).toEqual([
      'note:7',
      'note:8',
    ])
    removeKeywordDocument(index, 'note:7')
    expect([...searchKeywords(index, 'alp').keys()]).toEqual(['note:8'])
    expect(index.sortedWords).toEqual(['alpine'])
  })
  it('weights name matches above body matches', () => {
    const hits = searchKeywords(buildKeywordIndex(documents), 'retry')
    expect(hits.get('snippet:2')!.nameScore).toBe(0.8)
  })
  it('updates and removes documents, including the prefix lookup', () => {
    const index = buildKeywordIndex(documents)
    expect(searchKeywords(index, 'invent').has('snippet:1')).toBe(true)
    updateKeywordDocument(index, {
      ref: 'snippet:1',
      name: 'Staging hosts',
      body: 'nothing here',
    })
    expect(searchKeywords(index, 'invent').has('snippet:1')).toBe(false)
    removeKeywordDocument(index, 'snippet:2')
    expect(searchKeywords(index, 'retry').size).toBe(0)
    expect(index.docs.size).toBe(2)
  })
  it('filters before taking the top results', () => {
    const many = [
      ...Array.from({ length: 300 }, (_, index) => ({
        ref: `snippet:${index}`,
        name: `Snippet ${index}`,
        body: 'deploy deploy deploy',
      })),
      ...Array.from({ length: 5 }, (_, index) => ({
        ref: `note:${index}`,
        name: `Note ${index}`,
        body: 'deploy once',
      })),
    ]
    const hits = searchKeywords(
      buildKeywordIndex(many),
      'deploy',
      KEYWORD_SEARCH,
      ref => ref.startsWith('note:'),
    )
    expect([...hits.keys()].sort()).toEqual([
      'note:0',
      'note:1',
      'note:2',
      'note:3',
      'note:4',
    ])
  })
})

describe('nameScore', () => {
  it('ranks exact, prefix, token prefix and contains', () => {
    expect(nameScore('Nginx reverse proxy', 'nginx reverse proxy')).toBe(1)
    expect(nameScore('Nginx reverse proxy', 'nginx')).toBe(0.8)
    expect(nameScore('Nginx reverse proxy', 'rev')).toBe(0.6)
    expect(nameScore('Nginx reverse proxy', 'verse')).toBe(0.4)
    expect(nameScore('Nginx reverse proxy', 'apache')).toBe(0)
  })
})

describe('folder words', () => {
  it('count toward coverage but not toward text coverage', () => {
    const index = buildKeywordIndex([
      {
        ref: 'snippet:1',
        name: 'Schedule bucket',
        body: 'export function scheduleBucket()',
        folder: 'Background Jobs',
      },
      {
        ref: 'note:1',
        name: 'Loading states',
        body: 'background refresh keeps the job list',
        folder: 'Frontend',
      },
    ])
    const hits = searchKeywords(index, 'background job')
    expect(hits.get('snippet:1')).toMatchObject({
      coverage: 1,
      textCoverage: 0,
    })
    expect(hits.get('note:1')).toMatchObject({ coverage: 1, textCoverage: 1 })
    expect(searchKeywords(index, 'backg').get('snippet:1')?.coverage).toBe(1)
  })
})
