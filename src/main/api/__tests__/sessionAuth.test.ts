import { describe, expect, it } from 'vitest'
import {
  generateApiSessionToken,
  isSessionTokenAuthorized,
  resolveApiSessionToken,
} from '../sessionAuth'

describe('api session token', () => {
  it('generates a prefixed random token', () => {
    const first = generateApiSessionToken()
    const second = generateApiSessionToken()

    expect(first).toMatch(/^mc_session_[\w-]{43}$/)
    expect(second).not.toBe(first)
  })

  it('accepts only the matching bearer token', () => {
    const token = generateApiSessionToken()

    expect(isSessionTokenAuthorized(`Bearer ${token}`, token)).toBe(true)
    expect(isSessionTokenAuthorized(`bearer ${token}`, token)).toBe(true)
    expect(isSessionTokenAuthorized('Bearer invalid', token)).toBe(false)
    expect(isSessionTokenAuthorized(undefined, token)).toBe(false)
  })

  it('allows explicit token injection only in development', () => {
    expect(resolveApiSessionToken(true, ' benchmark-token ')).toBe(
      'benchmark-token',
    )
    expect(resolveApiSessionToken(false, 'benchmark-token')).not.toBe(
      'benchmark-token',
    )
  })
})
