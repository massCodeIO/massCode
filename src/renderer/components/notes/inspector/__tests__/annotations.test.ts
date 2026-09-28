import { describe, expect, it } from 'vitest'
import { parseBlockquoteCallout } from '../../cm-extensions/callouts'
import { getAnnotations } from '../annotations'

describe('note annotations', () => {
  it('collects every supported callout in document order with exact ranges', () => {
    const content
      = '> [!TODO] Add example\n> First line\n> Second line\n\n> [!NOTE]\n> Context\n\n> [!IMPORTANT]\n> Important\n\n> [!WARNING]\n> Warning'
    const result = getAnnotations(content)
    expect(result.map(item => item.type)).toEqual([
      'TODO',
      'NOTE',
      'IMPORTANT',
      'WARNING',
    ])
    expect(result[0]!.text).toBe('Add example\nFirst line\nSecond line')
    for (const item of result)
      expect(content.slice(item.from, item.to)).toBe(item.raw)
  })
  it('ignores examples in code and regular quotes; preserves duplicate and empty callouts', () => {
    const content
      = '```md\n> [!TODO]\n> Example\n```\n\n> Regular quote\n\n> [!TODO]\n\n> [!TODO]'
    expect(
      getAnnotations(content).map(item => [item.type, item.text]),
    ).toEqual([
      ['TODO', ''],
      ['TODO', ''],
    ])
  })
  it('uses the editor parser, including lowercase TODO', () => {
    expect(parseBlockquoteCallout('> [!todo] Write')).toMatchObject({
      type: 'TODO',
    })
    expect(getAnnotations('> [!todo]\n> Write')[0]!.text).toBe('Write')
    expect(getAnnotations('> [!CHECK]\n> Not a supported callout')).toEqual([])
  })
})
