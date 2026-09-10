import type { IpcMainInvokeEvent, WebContents } from 'electron'
import { expect, it, vi } from 'vitest'
import { registerHttpCookieHandlers } from '../../../ipc/handlers/httpCookies'
import { HttpCookieJar } from '../jar'

const jar = new HttpCookieJar()
vi.mock('../store', () => ({
  getHttpCookieJar: () => jar,
  onHttpCookiesChanged: () => () => {},
}))
it('validates sender, frame and payload before cookie access or mutation', () => {
  const handlers = new Map<
    string,
    (event: IpcMainInvokeEvent, payload?: unknown) => unknown
  >()
  const frame = { url: 'http://localhost:5177/#/http' }
  const owner = {
    mainFrame: frame,
    once: () => {},
    ipc: {
      handle: (name: string, handler: any) => handlers.set(name, handler),
    },
  } as unknown as WebContents
  registerHttpCookieHandlers(owner, 'http://localhost:5177')
  const event = {
    sender: owner,
    senderFrame: frame,
  } as unknown as IpcMainInvokeEvent
  const read = handlers.get('spaces:http:cookies:read')!
  expect(read(event, { requestId: 1 })).toEqual({
    domains: [],
    cookies: [],
    enabled: true,
  })
  for (const handler of handlers.values()) {
    expect(() => handler({ ...event, sender: {} as WebContents }, {})).toThrow(
      'Unauthorized',
    )
    expect(() =>
      handler(
        { ...event, senderFrame: { url: frame.url } } as IpcMainInvokeEvent,
        {},
      ),
    ).toThrow('Unauthorized')
  }
  frame.url = 'https://evil.test/'
  expect(() => read(event, { requestId: 1 })).toThrow('Unauthorized')
  frame.url = 'http://localhost:5177/#/http'
  expect(() =>
    handlers.get('spaces:http:cookies:save')!(event, {
      domain: 'example.com',
      raw: 'x'.repeat(16385),
    }),
  ).toThrow()
  expect(jar.read(null).cookies).toEqual([])
  jar.save('example.com', 'session=abc; Path=/api; Secure')
  const preview = handlers.get('spaces:http:cookies:preview')!
  expect(
    preview(event, { requestId: 1, url: 'https://example.com/api/users' }),
  ).toBe('session=abc')
  for (const url of [
    'http://example.com/api',
    'https://example.com/other',
    'https://other.example/api',
    '{{baseUrl}}',
    'file:///api',
  ]) {
    expect(preview(event, { requestId: 1, url })).toBe('')
  }
  jar.setEnabled(1, false)
  expect(preview(event, { requestId: 1, url: 'https://example.com/api' })).toBe(
    '',
  )
  expect(preview(event, { requestId: 2, url: 'https://example.com/api' })).toBe(
    'session=abc',
  )
})
