import type { IpcMainInvokeEvent, WebContents } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { isTrustedApiRequest, registerApiRequestHandler } from '../requestIpc'

function createWebContents(url = 'file:///app/index.html') {
  const mainFrame = { url }
  const handle = vi.fn()
  const webContents = {
    ipc: { handle },
    mainFrame,
  } as unknown as WebContents

  return { handle, mainFrame, webContents }
}

describe('api request IPC', () => {
  it.each(['https://example.com/', 'file:///different.html', 'invalid-url'])(
    'rejects unexpected main frame URL %s',
    (url) => {
      const { mainFrame, webContents } = createWebContents(url)
      expect(
        isTrustedApiRequest(
          {
            sender: webContents,
            senderFrame: mainFrame,
          } as unknown as IpcMainInvokeEvent,
          webContents,
          'file:///app/index.html',
        ),
      ).toBe(false)
    },
  )

  it('rejects another webContents even at the expected URL', () => {
    const { mainFrame, webContents } = createWebContents()
    expect(
      isTrustedApiRequest(
        { sender: {}, senderFrame: mainFrame } as unknown as IpcMainInvokeEvent,
        webContents,
        'file:///app/index.html',
      ),
    ).toBe(false)
  })

  it('trusts only the main frame at the expected renderer URL', () => {
    const { mainFrame, webContents } = createWebContents(
      'file:///app/index.html#/notes',
    )
    const event = {
      sender: webContents,
      senderFrame: mainFrame,
    } as unknown as IpcMainInvokeEvent

    expect(
      isTrustedApiRequest(event, webContents, 'file:///app/index.html'),
    ).toBe(true)
    expect(
      isTrustedApiRequest(
        { ...event, senderFrame: { url: 'file:///app/index.html' } } as never,
        webContents,
        'file:///app/index.html',
      ),
    ).toBe(false)
    expect(
      isTrustedApiRequest(
        { ...event, senderFrame: null } as never,
        webContents,
        'file:///app/index.html',
      ),
    ).toBe(false)
  })

  it('proxies only trusted requests to the fixed loopback origin', async () => {
    const { handle, mainFrame, webContents } = createWebContents()
    registerApiRequestHandler(
      webContents,
      'file:///app/index.html',
      'secret-token',
      4321,
    )
    const handler = handle.mock.calls[0][1]
    const fetch = vi.fn<typeof globalThis.fetch>(
      async () => new Response('ok', { status: 200 }),
    )
    vi.stubGlobal('fetch', fetch)
    const payload = {
      url: 'http://127.0.0.1:4321/notes',
      method: 'GET',
      headers: [
        ['cookie', 'must-not-leak'],
        ['authorization', 'spoofed'],
      ],
    }
    try {
      const result = await handler(
        { sender: webContents, senderFrame: mainFrame },
        payload,
      )
      expect(result.status).toBe(200)
      expect(new TextDecoder().decode(result.body)).toBe('ok')
      expect(fetch).toHaveBeenCalledWith(
        new URL(payload.url),
        expect.objectContaining({ redirect: 'error' }),
      )
      const options = fetch.mock.calls[0][1] as RequestInit
      expect(new Headers(options.headers).get('authorization')).toBe(
        'Bearer secret-token',
      )
      expect(new Headers(options.headers).has('cookie')).toBe(false)
      for (const url of [
        'https://example.com',
        'file:///tmp/test',
        'http://127.0.0.1:9999/',
        'http://user@127.0.0.1:4321/',
      ]) {
        await expect(
          handler(
            { sender: webContents, senderFrame: mainFrame },
            { ...payload, url },
          ),
        ).rejects.toThrow('Unauthorized API destination')
      }
      expect(fetch).toHaveBeenCalledTimes(1)
    }
    finally {
      vi.unstubAllGlobals()
    }
    await expect(
      handler(
        { sender: webContents, senderFrame: { url: mainFrame.url } },
        payload,
      ),
    ).rejects.toThrow('Unauthorized IPC sender')
  })
})
