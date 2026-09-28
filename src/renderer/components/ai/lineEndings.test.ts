import { describe, expect, it } from 'vitest'
import { lineEndingChange } from './lineEndings'

describe('line ending review metadata', () => {
  it('reveals CRLF to LF changes that CodeMirror normalizes away', () => {
    expect(lineEndingChange('a\r\nb\r\n', 'a\nb\n')).toEqual({
      before: 'crlf',
      after: 'lf',
    })
  })
  it('distinguishes lone CR from LF', () => {
    expect(lineEndingChange('a\rb', 'a\nb')).toEqual({
      before: 'cr',
      after: 'lf',
    })
  })
  it('detects mixed conventions and changes to their ordering', () => {
    expect(lineEndingChange('a\r\nb\nc', 'a\nb\nc')).toEqual({
      before: 'mixed',
      after: 'lf',
    })
    expect(lineEndingChange('a\r\nb\nc', 'a\nb\r\nc')).toEqual({
      before: 'mixed',
      after: 'mixed',
    })
    expect(lineEndingChange('a\rb\nc\r\nd', 'a\r\nb\rc\nd')).toEqual({
      before: 'mixed',
      after: 'mixed',
    })
  })
  it('does not report ordinary content or line-count changes as a convention change', () => {
    expect(lineEndingChange('a\nb', 'a\nb\nc')).toBeUndefined()
    expect(lineEndingChange('a\r\nb', 'new\r\ntext')).toBeUndefined()
    expect(lineEndingChange('', 'one line')).toBeUndefined()
    expect(lineEndingChange('one line', 'one line\nnew line')).toBeUndefined()
    expect(lineEndingChange('a\rb', 'ab')).toBeUndefined()
  })
})
