import type { IpcMainInvokeEvent, WebContents } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import {
  isTrustedApiSessionTokenRequest,
  registerApiSessionTokenHandler,
} from '../sessionTokenIpc'

function createWebContents(url = 'file:///app/index.html') {
  const mainFrame = { url }
  const handle = vi.fn()
  const webContents = {
    ipc: { handle },
    mainFrame,
  } as unknown as WebContents

  return { handle, mainFrame, webContents }
}

describe('api session token IPC', () => {
  it('trusts only the main frame at the expected renderer URL', () => {
    const { mainFrame, webContents } = createWebContents(
      'file:///app/index.html#/notes',
    )
    const event = {
      sender: webContents,
      senderFrame: mainFrame,
    } as unknown as IpcMainInvokeEvent

    expect(
      isTrustedApiSessionTokenRequest(
        event,
        webContents,
        'file:///app/index.html',
      ),
    ).toBe(true)
    expect(
      isTrustedApiSessionTokenRequest(
        { ...event, senderFrame: { url: 'file:///app/index.html' } } as never,
        webContents,
        'file:///app/index.html',
      ),
    ).toBe(false)
    expect(
      isTrustedApiSessionTokenRequest(
        { ...event, senderFrame: null } as never,
        webContents,
        'file:///app/index.html',
      ),
    ).toBe(false)
  })

  it('returns the token to a trusted sender and rejects other frames', async () => {
    const { handle, mainFrame, webContents } = createWebContents()
    registerApiSessionTokenHandler(
      webContents,
      'file:///app/index.html',
      'secret-token',
    )
    const handler = handle.mock.calls[0][1]

    await expect(
      handler({ sender: webContents, senderFrame: mainFrame }),
    ).resolves.toBe('secret-token')
    await expect(
      handler({ sender: webContents, senderFrame: { url: mainFrame.url } }),
    ).rejects.toThrow('Unauthorized IPC sender')
  })
})
