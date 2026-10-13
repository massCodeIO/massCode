import { describe, expect, it } from 'vitest'
import { meaningExcerpt, wordExcerpt } from '../excerpt'
import { buildKeywordIndex, searchKeywords } from '../keywordIndex'

function highlighted(excerpt: { text: string, ranges: [number, number][] }) {
  return excerpt.ranges.map(([from, to]) => excerpt.text.slice(from, to))
}

describe('wordExcerpt', () => {
  it('opens a 12-word window around the first whole-word match and returns ranges', () => {
    const text
      = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen'
    const excerpt = wordExcerpt(text, ['eight'])!
    expect(excerpt.text).toBe(
      'four five six seven eight nine ten eleven twelve thirteen fourteen fifteen',
    )
    expect(highlighted(excerpt)).toEqual(['eight'])
  })
  it('matches stemmed forms and ignores matches inside other words', () => {
    const excerpt = wordExcerpt('Подкапустник. Свёкла и капусты в борще', [
      'капуст',
    ])!
    expect(highlighted(excerpt)).toEqual(['капусты'])
  })
  it('highlights words of the prefix stems found by searchKeywords', () => {
    const text = 'Inventory deployment for staging'
    const index = buildKeywordIndex([
      { ref: 'snippet:1', name: 'Hosts', body: text },
    ])
    const hit = searchKeywords(index, 'inventory deplo').get('snippet:1')!
    expect(highlighted(wordExcerpt(text, hit.matchedStems)!)).toEqual([
      'Inventory',
      'deployment',
    ])
  })
  it('highlights a record matched by the stem of a prefix word, not by the prefix itself', () => {
    // «stri» раскрывается в «strings» со стемом «str»; вторая запись попала по этому стему.
    const index = buildKeywordIndex([
      { ref: 'note:1', name: 'A', body: 'typed strings here' },
      { ref: 'note:2', name: 'B', body: 'convert to str first' },
    ])
    const hit = searchKeywords(index, 'stri').get('note:2')!
    expect(
      highlighted(wordExcerpt('convert to str first', hit.matchedStems)!),
    ).toEqual(['str'])
  })
  it('finds chinese words', () => {
    expect(
      highlighted(wordExcerpt('在服务器上部署应用程序', ['部署'])!),
    ).toEqual(['部署'])
  })
  it('returns undefined without matches', () => {
    expect(wordExcerpt('nothing here', ['retry'])).toBeUndefined()
  })
})

describe('meaningExcerpt', () => {
  it('cuts at a word boundary within the limit', () => {
    const excerpt = meaningExcerpt(`${'word '.repeat(100)}`, 30)
    expect(excerpt.text.length).toBeLessThanOrEqual(30)
    expect(excerpt.text.endsWith('word')).toBe(true)
    expect(excerpt.ranges).toEqual([])
  })
})
