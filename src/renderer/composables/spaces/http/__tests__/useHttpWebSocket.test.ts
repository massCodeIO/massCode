import type { WsView } from '~/shared/httpWebSocket'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, reactive, ref, shallowRef, watch } from 'vue'

Object.assign(globalThis, { computed, ref, shallowRef, watch })
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
async function setup() {
  vi.resetModules()
  vi.useFakeTimers()
  const request = ref({ id: 1, pendingCloudDownload: false })
  const draft = ref({
    protocol: 'websocket',
    url: 'ws://localhost',
    headers: [],
    query: [],
    auth: { type: 'none' },
    body: 'hello',
  })
  const env = ref<number | null>(1)
  const loading = ref(false)
  const httpState = reactive({ requestId: 1 })
  const connected = deferred<WsView>()
  const read = deferred<WsView>()
  const sent = deferred<void>()
  const cleared = deferred<number>()
  const invoke = vi.fn(async (channel: string) => {
    if (channel === 'spaces:http:ws-connect')
      return connected.promise
    if (channel === 'spaces:http:ws-read')
      return read.promise
    if (channel === 'spaces:http:ws-send')
      return sent.promise
    if (channel === 'spaces:http:ws-clear')
      return cleared.promise
    return null
  })
  vi.doMock('@/electron', () => ({ ipc: { invoke } }))
  vi.doMock('../useHttpRequests', () => ({
    useHttpRequests: () => ({
      currentRequest: request,
      currentDraft: draft,
      isCurrentRequestLoading: loading,
    }),
  }))
  vi.doMock('../useHttpApp', () => ({ useHttpApp: () => ({ httpState }) }))
  vi.doMock('../useHttpEnvironments', () => ({
    useHttpEnvironments: () => ({ activeEnvironmentId: env }),
  }))
  vi.doMock('../useHttpSettings', () => ({
    useHttpSettings: () => ({ settings: {} }),
  }))
  const ws = (await import('../useHttpWebSocket')).useHttpWebSocket()
  return {
    ws,
    request,
    draft,
    env,
    loading,
    httpState,
    invoke,
    connected,
    read,
    sent,
    cleared,
  }
}
function snapshot(id: string): WsView {
  return {
    connectionId: id,
    state: 'open',
    messages: [],
    dropped: 0,
    lastId: 0,
  }
}
afterEach(() => vi.useRealTimers())

describe('webSocket UI lifecycle', () => {
  it('blocks connecting a loading or unavailable request', async () => {
    const ctx = await setup()
    ctx.loading.value = true
    await ctx.ws.connect()
    expect(ctx.invoke).not.toHaveBeenCalled()
    ctx.loading.value = false
    ctx.request.value.pendingCloudDownload = true
    await ctx.ws.connect()
    expect(ctx.invoke).not.toHaveBeenCalled()
  })

  it.each(['selection', 'environment', 'protocol'])(
    'disposes a pending connection on %s change and ignores its late response',
    async (change) => {
      const ctx = await setup()
      const promise = ctx.ws.connect()
      const id = ctx.ws.view.value!.connectionId
      if (change === 'selection')
        ctx.httpState.requestId = 2
      if (change === 'environment')
        ctx.env.value = 2
      if (change === 'protocol')
        ctx.draft.value.protocol = 'http'
      expect(ctx.ws.view.value).toBeNull()
      expect(ctx.invoke).toHaveBeenCalledWith('spaces:http:ws-dispose', {
        connectionId: id,
      })
      ctx.connected.resolve(snapshot(id))
      await promise
      expect(ctx.ws.view.value).toBeNull()
      expect(vi.getTimerCount()).toBe(0)
    },
  )

  it('does not restore log rows from a poll that finished after clearing', async () => {
    const ctx = await setup()
    const promise = ctx.ws.connect()
    const id = ctx.ws.view.value!.connectionId
    ctx.connected.resolve(snapshot(id))
    await Promise.resolve()
    await Promise.resolve()
    const clear = ctx.ws.clear()
    ctx.cleared.resolve(3)
    await clear
    ctx.read.resolve({
      ...snapshot(id),
      lastId: 2,
      messages: [
        {
          id: 2,
          time: 0,
          direction: 'incoming',
          kind: 'text',
          text: 'stale',
          bytes: 5,
          truncated: false,
        },
      ],
    })
    await promise
    expect(ctx.ws.view.value?.messages).toEqual([])
    expect(ctx.ws.view.value?.lastId).toBe(3)
    ctx.ws.dispose()
  })

  it('clearing does not leave an in-flight send permanently busy', async () => {
    const ctx = await setup()
    const promise = ctx.ws.connect()
    const id = ctx.ws.view.value!.connectionId
    ctx.connected.resolve(snapshot(id))
    ctx.read.resolve(snapshot(id))
    await promise
    const send = ctx.ws.send()
    expect(ctx.ws.sending.value).toBe(true)
    const clear = ctx.ws.clear()
    ctx.cleared.resolve(0)
    await clear
    ctx.sent.resolve()
    await send
    expect(ctx.ws.sending.value).toBe(false)
    ctx.ws.dispose()
  })
})
