import { describe, expect, it } from 'vitest'
import { shouldReplaceCalloutMarker } from '../callouts'

describe('shouldReplaceCalloutMarker', () => {
  it('always replaces marker in replace mode', () => {
    expect(shouldReplaceCalloutMarker('replace', true, true)).toBe(true)
    expect(shouldReplaceCalloutMarker('replace', false, false)).toBe(true)
  })

  it('in smart mode keeps raw marker only on focused callout line', () => {
    expect(shouldReplaceCalloutMarker('smart', true, true)).toBe(false)
    expect(shouldReplaceCalloutMarker('smart', false, true)).toBe(true)
  })

  it('in smart mode replaces marker when editor is blurred', () => {
    expect(shouldReplaceCalloutMarker('smart', true, false)).toBe(true)
  })

  it('in raw mode never replaces marker', () => {
    expect(shouldReplaceCalloutMarker('raw', true, true)).toBe(false)
    expect(shouldReplaceCalloutMarker('raw', false, false)).toBe(false)
  })
})
