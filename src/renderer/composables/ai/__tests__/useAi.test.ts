import type { AiContext } from '../useAi'
import type { AiEvent, AiStart } from '~/shared/ai'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, reactive, ref } from 'vue'
import { aiStartSchema } from '~/shared/ai'

Object.assign(globalThis, { computed, reactive, ref })

async function setup() {
  vi.resetModules()
  let vaultPath = '/vault-a'
  let listener: (_event: unknown, event: AiEvent) => void = () => {}
  const invoke = vi.fn(
    async (_channel: string, payload: unknown): Promise<unknown> => {
      structuredClone(payload)
      return { ok: true, data: null }
    },
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
  const write = vi.fn(() => true)
  ai.registerEditor(() => snapshot, write)
  return {
    ai,
    write,
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

function propose(request: AiStart, oldText: string, newText: string) {
  return {
    requestId: request.requestId,
    type: 'tools' as const,
    calls: [
      {
        id: 'call_1',
        type: 'function' as const,
        function: {
          name: 'propose_edit' as const,
          arguments: JSON.stringify({
            context_id: request.editContextId,
            summary: 'Fix',
            edits: [{ old_text: oldText, new_text: newText }],
          }),
        },
      },
    ],
  }
}

describe('structured edit proposals', () => {
  it('reviews tools independently of Markdown blocks and records applied tool results', async () => {
    const { ai, updateBuffer, request, emit, write } = await setup()
    updateBuffer({
      text: 'before\nold\nafter',
      selection: 'old',
      selectionFrom: 7,
      selectionTo: 10,
    })
    await ai.send('Fix')
    emit({
      requestId: request().requestId,
      type: 'delta',
      text: 'Examples:\n```js\na\n```\n```js\nb\n```',
    })
    emit(propose(request(), 'old', 'new'))
    emit({
      requestId: request().requestId,
      type: 'delta',
      text: 'Here is the code:\n```js\nnew\n```\nExample:\n```js\nexample\n```',
    })
    const message = ai.conversation.value!.messages.at(-1)!
    expect(ai.applyEdit(message)).toBe(false)
    emit({ requestId: request().requestId, type: 'done' })
    updateBuffer({ selection: '' })
    expect(ai.applyEdit(message)).toBe(true)
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({ from: 7, to: 10 }),
      'new',
    )
    expect(ai.applyEdit(message)).toBe(false)
    ai.contextMode.value = 'fragment'
    await ai.send('Explain result')
    const messages = request().messages
    expect(aiStartSchema.safeParse(request()).success).toBe(true)
    expect(ai.conversation.value?.error).toBeUndefined()
    expect(messages[1].tool_calls).toHaveLength(1)
    expect(messages[2]).toMatchObject({ role: 'tool', tool_call_id: 'call_1' })
    expect(JSON.parse(messages[2].content).status).toBe('applied')
    expect(messages[3]).toMatchObject({
      role: 'assistant',
      content: message.content,
    })
    expect(message.content).toContain('Example:')
  })
  it('never derives edits from Markdown', async () => {
    const { ai, request, emit, write } = await setup()
    ai.contextMode.value = 'fragment'
    await ai.send('Fix')
    emit({
      requestId: request().requestId,
      type: 'delta',
      text: '```js\nreplacement\n```',
    })
    emit({ requestId: request().requestId, type: 'done' })
    const message = ai.conversation.value!.messages.at(-1)!
    expect(message.replacement).toBeUndefined()
    expect(ai.applyEdit(message)).toBe(false)
    expect(write).not.toHaveBeenCalled()
  })
  it('rejects stale, cancelled and cross-vault proposals', async () => {
    const { ai, updateBuffer, request, emit, write, switchVault }
      = await setup()
    ai.contextMode.value = 'fragment'
    await ai.send('Fix')
    emit(propose(request(), 'const first = 1;', 'const first = 3;'))
    emit({ requestId: request().requestId, type: 'done' })
    const message = ai.conversation.value!.messages.at(-1)!
    updateBuffer({ text: 'user change' })
    expect(ai.applyEdit(message)).toBe(false)
    switchVault()
    expect(ai.applyEdit(message)).toBe(false)
    await ai.send('Fix')
    emit(propose(request(), 'user change', 'new'))
    ai.cancel()
    expect(ai.applyEdit(ai.conversation.value!.messages.at(-1)!)).toBe(false)
    expect(write).not.toHaveBeenCalled()
  })
  it('records rejection and leaves editor unchanged', async () => {
    const { ai, request, emit, write } = await setup()
    ai.contextMode.value = 'fragment'
    await ai.send('Fix')
    emit(propose(request(), 'const first = 1;', 'const first = 3;'))
    emit({ requestId: request().requestId, type: 'done' })
    const message = ai.conversation.value!.messages.at(-1)!
    ai.rejectEdit(message)
    expect(ai.applyEdit(message)).toBe(false)
    await ai.send('Try another way')
    expect(JSON.parse(request().messages[2].content).status).toBe('rejected')
    expect(write).not.toHaveBeenCalled()
  })
})

describe('retry, stopped proposals and history budget', () => {
  it('keeps a validated proposal after stopping and records its pending/applied status', async () => {
    const { ai, request, emit } = await setup()
    ai.contextMode.value = 'fragment'
    await ai.send('Fix')
    emit(propose(request(), 'const first = 1;', 'const first = 3;'))
    ai.cancel()
    const proposal = ai.conversation.value!.messages.at(-1)!
    expect(ai.canApply(proposal)).toBe(true)
    expect(ai.applyEdit(proposal)).toBe(true)
    expect(ai.canRetry(proposal)).toBe(false)
    await ai.send('Explain')
    expect(JSON.parse(request().messages[2].content).status).toBe('applied')
    expect(aiStartSchema.safeParse(request()).success).toBe(true)
  })

  it('retries the last failed attempt with fresh context and preserves a newer draft', async () => {
    const { ai, request, emit, updateBuffer } = await setup()
    ai.contextMode.value = 'fragment'
    await ai.send('Fix', true)
    const first = request()
    emit({ requestId: first.requestId, type: 'error', error: 'connection' })
    const failed = ai.conversation.value!.messages.at(-1)!
    ai.conversation.value!.draft = 'Next question'
    ai.contextMode.value = 'selection'
    updateBuffer({ text: 'new current fragment' })
    expect(await ai.retry(failed)).toBe(true)
    expect(request().requestId).not.toBe(first.requestId)
    expect(request().messages).toHaveLength(1)
    expect(request().messages[0].content).toContain('new current fragment')
    expect(request().messages[0].content).toContain('Use propose_edit')
    expect(ai.conversation.value!.messages).toHaveLength(2)
    expect(ai.conversation.value!.draft).toBe('Next question')
    emit({ requestId: first.requestId, type: 'delta', text: 'late' })
    expect(ai.conversation.value!.messages.at(-1)!.content).toBe('')
  })

  it('keeps the failed attempt if retry cannot fit its fresh context', async () => {
    const { ai, updateBuffer } = await setup()
    await ai.send('Question')
    ai.cancel()
    const failed = ai.conversation.value!.messages.at(-1)!
    updateBuffer({ selection: 'я'.repeat(140_000) })
    expect(await ai.retry(failed)).toBe(false)
    expect(ai.conversation.value!.messages.at(-1)).toBe(failed)
    expect(ai.canApply(failed)).toBe(false)
  })

  it('trims only request history and retains the visible conversation', async () => {
    const { ai, request, emit } = await setup()
    for (let i = 0; i < 24; i++) {
      await ai.send(`Question ${i}`)
      emit({ requestId: request().requestId, type: 'delta', text: 'Answer' })
      emit({ requestId: request().requestId, type: 'done' })
    }
    expect(request().messages.length).toBeLessThanOrEqual(40)
    expect(request().messages[0].role).toBe('user')
    expect(aiStartSchema.safeParse(request()).success).toBe(true)
    expect(ai.conversation.value!.messages).toHaveLength(48)
    expect(ai.conversation.value!.historyOmitted).toBe(true)
  })
})
