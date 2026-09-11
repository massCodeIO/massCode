import type { IpcMainInvokeEvent, WebContents } from 'electron'
import { describe, expect, it } from 'vitest'
import { registerHttpTerminalHandlers } from '../../../ipc/handlers/httpTerminal'

describe('terminal IPC ownership', () => {
  it('rejects other windows, child frames and foreign navigation before dispatch', () => {
    const handlers = new Map<
      string,
      (event: IpcMainInvokeEvent, payload?: unknown) => unknown
    >()
    const frame = { url: 'http://localhost:5177/#/http' }
    const owner = {
      mainFrame: frame,
      ipc: {
        handle: (
          name: string,
          handler: (event: IpcMainInvokeEvent) => unknown,
        ) => handlers.set(name, handler),
      },
      once: () => {},
      on: () => {},
    } as unknown as WebContents
    registerHttpTerminalHandlers(owner, 'http://localhost:5177')
    const list = handlers.get('spaces:http:terminal:list')!
    const event = {
      sender: owner,
      senderFrame: frame,
    } as unknown as IpcMainInvokeEvent
    expect(list(event)).toEqual([])
    expect(() => list({ ...event, sender: {} as WebContents })).toThrow(
      'Unauthorized',
    )
    expect(() =>
      list({ ...event, senderFrame: { url: frame.url } } as IpcMainInvokeEvent),
    ).toThrow('Unauthorized')
    frame.url = 'https://example.com/'
    expect(() => list(event)).toThrow('Unauthorized')
    frame.url = 'http://localhost:5177/#/http'
    expect(() =>
      handlers.get('spaces:http:terminal:create')!(event, { cols: -1 }),
    ).toThrow()
    expect(() =>
      handlers.get('spaces:http:terminal:kill')!(event, {
        id: '00000000-0000-4000-8000-000000000000',
      }),
    ).toThrow('TERMINAL_SESSION_NOT_FOUND')
  })
})
