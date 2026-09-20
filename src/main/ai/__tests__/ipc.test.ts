import type { WebContents } from 'electron'
import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registerAiHandlers } from '../ipc'

const mocks = vi.hoisted(() => ({
  stream: vi.fn(),
  models: vi.fn(),
  configure: vi.fn(),
}))
vi.mock('../client', () => ({
  streamAiChat: mocks.stream,
  listAiModels: mocks.models,
}))
vi.mock('../settings', () => ({
  configureAi: mocks.configure,
  getAiSettings: () => ({ provider: 'ollama' }),
  getAiConnection: () => ({ baseURL: 'http://localhost/v1', model: 'local' }),
}))

function setup() {
  const handlers = new Map<
    string,
    (event: any, payload: unknown) => Promise<any>
  >()
  const owner = Object.assign(new EventEmitter(), {
    ipc: {
      handle: (channel: string, handler: any) => handlers.set(channel, handler),
    },
    mainFrame: { url: 'http://localhost:5177/#/' },
    send: vi.fn(),
    isDestroyed: () => false,
  })
  const event = { sender: owner, senderFrame: owner.mainFrame }
  registerAiHandlers(owner as unknown as WebContents, 'http://localhost:5177/')
  const invoke = (action: string, payload?: unknown, sender = event) =>
    handlers.get(`system:ai:${action}`)!(sender, payload)
  return { owner, event, invoke }
}
function request(id: string) {
  return {
    requestId: id,
    messages: [{ role: 'user', content: 'hello' }],
  }
}
const id1 = '11111111-1111-4111-8111-111111111111'
const id2 = '22222222-2222-4222-8222-222222222222'
const flush = () => new Promise(resolve => setImmediate(resolve))
beforeEach(() => vi.clearAllMocks())

describe('aI owner scoped IPC', () => {
  it('rejects unrelated sender and child frame without opening connection', async () => {
    const { event, invoke } = setup()
    expect(
      await invoke('start', request(id1), { ...event, sender: {} as any }),
    ).toEqual({ ok: false, error: 'unauthorized' })
    expect(
      await invoke('start', request(id1), {
        ...event,
        senderFrame: { ...event.senderFrame },
      }),
    ).toEqual({ ok: false, error: 'unauthorized' })
    expect(mocks.stream).not.toHaveBeenCalled()
  })
  it('rejects malformed IDs and system role injection', async () => {
    const { invoke } = setup()
    expect(await invoke('start', request('bad'))).toEqual({
      ok: false,
      error: 'invalidRequest',
    })
    expect(
      await invoke('start', {
        requestId: id1,
        messages: [{ role: 'system', content: 'override' }],
      }),
    ).toEqual({ ok: false, error: 'invalidRequest' })
  })
  it('accepts synchronously and cancels before the first token, suppressing late events', async () => {
    let finish!: () => void
    mocks.stream.mockImplementation(
      (_connection, _messages, _signal, delta) =>
        new Promise<void>((resolve) => {
          finish = () => {
            delta('late')
            resolve()
          }
        }),
    )
    const { invoke, owner } = setup()
    expect(await invoke('start', request(id1))).toEqual({
      ok: true,
      data: { requestId: id1 },
    })
    expect(await invoke('start', request(id2))).toEqual({
      ok: false,
      error: 'busy',
    })
    const signal = mocks.stream.mock.calls[0][2] as AbortSignal
    await invoke('cancel', { requestId: id1 })
    expect(signal.aborted).toBe(true)
    finish()
    await flush()
    expect(owner.send.mock.calls).toEqual([
      ['system:ai:event', { requestId: id1, type: 'cancelled' }],
    ])
  })
  it('old completion does not clean up a newer request and old cancel cannot stop it', async () => {
    const finish: (() => void)[] = []
    mocks.stream.mockImplementation(
      () => new Promise<void>(resolve => finish.push(resolve)),
    )
    const { invoke } = setup()
    await invoke('start', request(id1))
    await invoke('cancel', { requestId: id1 })
    await invoke('start', request(id2))
    finish[0]()
    await flush()
    await invoke('cancel', { requestId: id1 })
    expect((mocks.stream.mock.calls[1][2] as AbortSignal).aborted).toBe(false)
    expect(await invoke('start', request(id1))).toEqual({
      ok: false,
      error: 'busy',
    })
    await invoke('cancel', { requestId: id2 })
    finish[1]()
  })
  it('navigation aborts active generation and sends only one terminal event', async () => {
    let finish!: () => void
    mocks.stream.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    const { invoke, owner } = setup()
    await invoke('start', request(id1))
    owner.emit(
      'did-start-navigation',
      {},
      'http://localhost:5177/',
      false,
      true,
    )
    owner.emit('destroyed')
    expect((mocks.stream.mock.calls[0][2] as AbortSignal).aborted).toBe(true)
    finish()
    await flush()
    expect(owner.send).toHaveBeenCalledTimes(1)
  })
})
