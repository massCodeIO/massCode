import { describe, expect, it } from 'vitest'
import { parseListPrefix } from '../listLineIndent'

describe('parseListPrefix', () => {
  it('matches unordered list markers', () => {
    expect(parseListPrefix('- item')?.[1]).toBe('- ')
    expect(parseListPrefix('* item')?.[1]).toBe('* ')
    expect(parseListPrefix('+ item')?.[1]).toBe('+ ')
  })

  it('matches nested unordered list markers', () => {
    expect(parseListPrefix('  - item')?.[1]).toBe('  - ')
    expect(parseListPrefix('    - item')?.[1]).toBe('    - ')
  })

  it('matches ordered list markers', () => {
    expect(parseListPrefix('1. item')?.[1]).toBe('1. ')
    expect(parseListPrefix('10. item')?.[1]).toBe('10. ')
    expect(parseListPrefix('123. item')?.[1]).toBe('123. ')
  })

  it('matches nested ordered list markers', () => {
    expect(parseListPrefix('  1. item')?.[1]).toBe('  1. ')
  })

  it('matches task markers', () => {
    const match = parseListPrefix('- [ ] task')
    expect(match?.[1]).toBe('- ')
    expect(match?.[2]).toBe('[ ]')
  })

  it('matches checked task markers', () => {
    const matchLower = parseListPrefix('- [x] done')
    expect(matchLower?.[2]).toBe('[x]')

    const matchUpper = parseListPrefix('- [X] done')
    expect(matchUpper?.[2]).toBe('[X]')
  })

  it('matches nested task markers', () => {
    const match = parseListPrefix('  - [ ] nested task')
    expect(match?.[1]).toBe('  - ')
    expect(match?.[2]).toBe('[ ]')
  })

  it('captures full prefix for task markers', () => {
    const match = parseListPrefix('- [ ] task')
    expect(match?.[0]).toBe('- [ ] ')
  })

  it('returns null for non-list lines', () => {
    expect(parseListPrefix('regular text')).toBeNull()
    expect(parseListPrefix('# heading')).toBeNull()
    expect(parseListPrefix('> quote')).toBeNull()
    expect(parseListPrefix('')).toBeNull()
  })
})
