import type { AiContext } from '../useAi'
import type { AiEvent, AiStart } from '~/shared/ai'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, reactive, ref } from 'vue'

Object.assign(globalThis, { computed, reactive, ref })

async function setup() {
  vi.resetModules()
  let vaultPath = '/vault-a'
  let listener: (_event: unknown, event: AiEvent) => void = () => {}
  const invoke = vi.fn(
    async (_channel: string, _payload: unknown): Promise<unknown> => ({
      ok: true,
      data: null,
    }),
  )
  vi.doMock('@/electron', () => ({
    ipc: {
      invoke,
      on: vi.fn((_channel, callback) => {
        listener = callback
      }),
      removeListener: vi.fn(),
    },
    store: {
      app: { get: () => false, set: vi.fn() },
      preferences: {
        get: (key: string) =>
          key === 'storage.vaultPath' ? vaultPath : '/legacy-root',
      },
    },
  }))
  const { useAi } = await import('../useAi')
  const ai = useAi()
  let snapshot: AiContext | undefined = {
    snippetId: 1,
    contentId: 10,
    text: 'const first = 1;\nconst selected = 2;',
    selection: 'const selected = 2;',
    language: 'javascript',
  }
  ai.registerEditor(() => snapshot)
  return {
    ai,
    invoke,
    emit: (event: AiEvent) => listener(null, event),
    setSnapshot(value: AiContext | undefined) {
      snapshot = value
      ai.setContext(value)
    },
    updateBuffer(value: Partial<AiContext>) {
      snapshot = { ...snapshot!, ...value }
    },
    switchVault() {
      vaultPath = '/vault-b'
      ai.setContext(snapshot)
    },
    request() {
      return invoke.mock.calls
        .filter(([channel]) => channel === 'system:ai:start')
        .at(-1)![1] as AiStart
    },
  }
}

beforeEach(() => vi.clearAllMocks())

describe('aI chat context and request lifecycle', () => {
  it('captures unsaved selection at send time without attaching the rest of the fragment', async () => {
    const { ai, updateBuffer, request } = await setup()
    updateBuffer({
      text: 'private surrounding text',
      selection: 'const live = 3;',
    })
    await ai.send('Explain this')
    expect(request().messages[0].content).toContain('const live = 3;')
    expect(request().messages[0].content).not.toContain(
      'private surrounding text',
    )
    expect(ai.conversation.value?.messages[0].context).toBe('const live = 3;')
  })

  it('attaches the full current fragment only when chosen', async () => {
    const { ai, updateBuffer, request } = await setup()
    updateBuffer({ text: 'const unsavedWhole = 42;' })
    ai.contextMode.value = 'fragment'
    await ai.send('Explain the fragment')
    expect(request().messages[0].content).toContain('const unsavedWhole = 42;')
    expect(request().messages[0].content).not.toContain('const selected = 2;')
  })

  it('cancels when changing fragments and ignores late events from the previous request', async () => {
    const { ai, request, emit, setSnapshot, invoke } = await setup()
    await ai.send('First question')
    const old = request()
    emit({ requestId: old.requestId, type: 'delta', text: 'Partial A' })
    setSnapshot({
      snippetId: 1,
      contentId: 11,
      language: 'javascript',
      text: 'second',
      selection: '',
    })
    expect(invoke).toHaveBeenCalledWith('system:ai:cancel', {
      requestId: old.requestId,
    })
    await ai.send('Second question')
    const current = request()
    emit({ requestId: old.requestId, type: 'delta', text: 'Late A' })
    emit({ requestId: old.requestId, type: 'done' })
    expect(ai.isStreaming.value).toBe(true)
    emit({ requestId: current.requestId, type: 'delta', text: 'Answer B' })
    emit({ requestId: current.requestId, type: 'done' })
    expect(ai.conversation.value?.messages.at(-1)?.content).toBe('Answer B')
    expect(ai.isStreaming.value).toBe(false)
    setSnapshot({
      snippetId: 1,
      contentId: 10,
      language: 'javascript',
      text: 'first',
      selection: '',
    })
    expect(ai.conversation.value?.messages.at(-1)).toMatchObject({
      content: 'Partial A',
      status: 'cancelled',
    })
  })

  it('clears conversations when the markdown vault changes even if the legacy root and IDs match', async () => {
    const { ai, request, emit, switchVault, invoke } = await setup()
    await ai.send('Private vault A question')
    const previous = request()
    switchVault()
    expect(invoke).toHaveBeenCalledWith('system:ai:cancel', {
      requestId: previous.requestId,
    })
    emit({
      requestId: previous.requestId,
      type: 'delta',
      text: 'Private answer',
    })
    expect(ai.conversation.value?.messages).toEqual([])
    await ai.send('Vault B question')
    expect(request().messages).toHaveLength(1)
    expect(request().messages[0].content).not.toContain('Private vault A')
  })

  it('keeps the conversation when the panel is closed and reopened', async () => {
    const { ai, request, emit } = await setup()
    await ai.send('Question')
    emit({ requestId: request().requestId, type: 'delta', text: 'Answer' })
    emit({ requestId: request().requestId, type: 'done' })
    ai.setOpen(false)
    ai.setOpen(true)
    expect(ai.conversation.value?.messages.at(-1)?.content).toBe('Answer')
  })

  it('does not revive a cancelled request when its start acknowledgment arrives late', async () => {
    const { ai, invoke, request, emit } = await setup()
    let acknowledge!: (value: unknown) => void
    invoke.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          acknowledge = resolve
        }),
    )
    const pending = ai.send('Question')
    const started = request()
    ai.cancel()
    acknowledge({ ok: true, data: { requestId: started.requestId } })
    await pending
    emit({
      requestId: started.requestId,
      type: 'delta',
      text: 'Should be ignored',
    })
    expect(ai.isStreaming.value).toBe(false)
    expect(ai.conversation.value?.messages.at(-1)).toMatchObject({
      content: '',
      status: 'cancelled',
    })
  })

  it('rejects oversized context without sending or truncating it', async () => {
    const { ai, updateBuffer, invoke } = await setup()
    updateBuffer({ selection: 'я'.repeat(140_000) })
    expect(await ai.send('Question')).toBe(false)
    expect(
      invoke.mock.calls.some(([channel]) => channel === 'system:ai:start'),
    ).toBe(false)
    expect(ai.conversation.value?.messages).toEqual([])
    expect(ai.conversation.value?.error).toBe('inputLimit')
  })
})
