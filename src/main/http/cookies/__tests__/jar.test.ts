import type { CookieState } from '../jar'
import { describe, expect, it, vi } from 'vitest'
import { HttpCookieJar, normalizeCookieDomain } from '../jar'

describe('hTTP cookies', () => {
  it('allows empty values and expiry-based deletion in the manager', () => {
    const jar = new HttpCookieJar()
    jar.save('example.com', 'empty=; Path=/')
    expect(jar.header('https://example.com/')).toBe('empty=')
    jar.save('example.com', 'empty=; Path=/; Max-Age=0')
    expect(jar.header('https://example.com/')).toBe('')
    expect(jar.read(null).cookies).toEqual([])
  })
  it('does not extend Max-Age when sending cookies repeatedly', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-09-09T12:00:00Z'))
      const jar = new HttpCookieJar()
      jar.receive('https://example.com/', ['short=yes; Max-Age=2; Path=/'])
      vi.advanceTimersByTime(1500)
      expect(jar.header('https://example.com/')).toBe('short=yes')
      vi.advanceTimersByTime(600)
      expect(jar.header('https://example.com/')).toBe('')
      expect(jar.read(null).cookies).toEqual([])
    }
    finally {
      vi.useRealTimers()
    }
  })
  it('matches domain, path, secure, expiry and host-only cookies', () => {
    const jar = new HttpCookieJar()
    jar.receive('https://api.example.com/a/login', [
      'host=one; Path=/',
      'parent=two; Domain=example.com; Path=/',
      'path=three; Path=/a',
      'secure=four; Secure; HttpOnly; Path=/',
      'expired=no; Max-Age=0',
      'wrong=no; Domain=evil.com',
    ])
    expect(jar.header('https://api.example.com/a/test')).toBe(
      'path=three; host=one; parent=two; secure=four',
    )
    expect(jar.header('http://api.example.com/abc')).toBe(
      'host=one; parent=two',
    )
    expect(jar.header('https://sub.api.example.com/')).toBe('parent=two')
    expect(jar.header('https://evil.com/')).toBe('')
    jar.receive('https://api.example.com/', ['host=; Path=/; Max-Age=0'])
    expect(jar.header('https://api.example.com/')).not.toContain('host=')
  })
  it('normalizes domains and persists edits, removals and request opt-out', () => {
    let saved: CookieState | undefined
    const jar = new HttpCookieJar(undefined, (value) => {
      saved = value
    })
    expect(normalizeCookieDomain('https://API.example.com:8443/path')).toBe(
      'api.example.com',
    )
    jar.addDomain('https://api.example.com:8443')
    jar.save('api.example.com', 'one=first; Path=/; HttpOnly')
    expect(jar.read(null).cookies[0].value).toBe('first')
    const id = jar.read(null).cookies[0].id
    expect(() =>
      jar.save('api.example.com', 'one=bad; Domain=evil.com', id),
    ).toThrow()
    expect(jar.header('https://api.example.com')).toBe('one=first')
    jar.save('api.example.com', 'two=second; Path=/a', id)
    expect(jar.read(null).cookies).toHaveLength(1)
    jar.setEnabled(7, false)
    const restored = new HttpCookieJar(saved)
    expect(restored.enabled(7)).toBe(false)
    expect(restored.enabled(8)).toBe(true)
    expect(restored.header('https://api.example.com/a', 'manual=yes')).toBe(
      'two=second; manual=yes',
    )
    restored.removeDomain('api.example.com')
    expect(restored.read(null).domains).toEqual([])
    expect(restored.header('https://api.example.com/a')).toBe('')
  })
  it('keeps same-name cookies on distinct paths and clears every domain', () => {
    const jar = new HttpCookieJar()
    jar.save('example.com', 'sid=root; Path=/')
    jar.save('example.com', 'sid=deep; Path=/a')
    expect(jar.header('https://example.com/a')).toBe('sid=deep; sid=root')
    jar.remove(
      jar.read(null).cookies.find(cookie => cookie.path === '/')!.id,
    )
    expect(jar.header('https://example.com/')).toBe('')
    jar.clear()
    expect(jar.read(null).cookies).toEqual([])
    expect(jar.read(null).domains).toEqual([])
  })
})
