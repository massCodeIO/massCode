import { expect, it, vi } from 'vitest'
import { getHttpCookieJar } from '../store'

const mock = vi.hoisted(() => ({
  vault: '/vault-one',
  vaults: {} as Record<string, unknown>,
}))
vi.mock('../../../storage/providers/markdown/runtime/paths', () => ({
  getVaultPath: () => mock.vault,
}))
vi.mock('electron-store', () => ({
  default: class {
    get() {
      return mock.vaults
    }

    set(_key: string, value: Record<string, unknown>) {
      mock.vaults = value
    }
  },
}))
it('isolates cookies and request opt-out between vaults', () => {
  const first = getHttpCookieJar()
  first.save('example.com', 'sid=first; Path=/')
  first.setEnabled(1, false)
  mock.vault = '/vault-two'
  const second = getHttpCookieJar()
  expect(second.header('https://example.com/')).toBe('')
  expect(second.enabled(1)).toBe(true)
  second.save('example.com', 'sid=second; Path=/')
  mock.vault = '/vault-one'
  expect(getHttpCookieJar().header('https://example.com/')).toBe('sid=first')
  expect(getHttpCookieJar().enabled(1)).toBe(false)
  expect(Object.keys(mock.vaults)).toHaveLength(2)
})
