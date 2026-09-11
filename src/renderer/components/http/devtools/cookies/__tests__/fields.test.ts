import { describe, expect, it } from 'vitest'
import { parseCookieFields, serializeCookieFields } from '../fields'

describe('cookie field editor', () => {
  it('preserves equals in values, expiry, scope and extra attributes across edits', () => {
    const fields = parseCookieFields(
      'token=a=b==; Domain=example.com; Path=/api; Expires=Wed, 09 Sep 2026 12:00:00 GMT; Max-Age=600; Secure; HttpOnly; SameSite=Lax',
      'api.example.com',
    )
    fields.value = 'changed=='
    const result = parseCookieFields(
      serializeCookieFields(fields),
      'api.example.com',
    )
    expect(result).toEqual({ ...fields, value: 'changed==' })
    expect(result.hostOnly).toBe(false)
  })
  it('keeps host-only and session cookies and allows empty values', () => {
    const fields = parseCookieFields('empty=; Path=/', 'localhost')
    expect(fields.hostOnly).toBe(true)
    expect(serializeCookieFields(fields)).toBe('empty=; Path=/')
    fields.httpOnly = true
    expect(serializeCookieFields(fields)).toBe('empty=; Path=/; HttpOnly')
  })
  it('rejects malformed dates and attribute injection without losing the draft', () => {
    const fields = parseCookieFields('one=value; Path=/', 'example.com')
    fields.expires = 'not a date'
    expect(() => serializeCookieFields(fields)).toThrow('invalidExpires')
    fields.expires = ''
    fields.value = 'value; Domain=other.test'
    expect(() => serializeCookieFields(fields)).toThrow('invalidCookie')
  })
})
