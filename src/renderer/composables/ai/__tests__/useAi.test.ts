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
      on: vi.fn((channel, callback) => {
        if (channel === 'system:ai:event')
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
  it('replaces search commentary with the final answer while retaining activity', async () => {
    const { ai, emit, request } = await setup()
    await ai.send('Find order details')
    const requestId = request().requestId
    emit({ requestId, type: 'delta', text: 'Maybe an unrelated item' })
    emit({ requestId, type: 'answerReset' })
    emit({
      requestId,
      type: 'activity',
      name: 'search_vault',
      detail: '{"items":[]}',
    })
    emit({ requestId, type: 'delta', text: 'Order details' })
    emit({ requestId, type: 'done' })
    expect(ai.conversation.value.messages.at(-1)?.content).toBe(
      'Order details',
    )
    expect(ai.conversation.value.messages.at(-1)?.activity).toHaveLength(1)
  })

  it('follows the open editor and respects removal', async () => {
    const { ai, setSnapshot } = await setup()
    ai.setOpen(true)
    expect(ai.contextMode.value).toBe('fragment')
    expect(ai.attachedEditor.value?.snippetId).toBe(1)
    setSnapshot({
      snippetId: 3,
      contentId: 30,
      text: 'third',
      selection: '',
      language: 'text',
    })
    expect(ai.attachedEditor.value?.snippetId).toBe(3)
    ai.removeEditorContext()
    setSnapshot({
      snippetId: 2,
      contentId: 20,
      text: 'next',
      selection: '',
      language: 'text',
    })
    ai.setOpen(false)
    ai.setOpen(true)
    expect(ai.contextMode.value).toBe('none')
    ai.clearConversation()
    expect(ai.attachedEditor.value?.snippetId).toBe(2)
    setSnapshot({
      snippetId: 4,
      contentId: 40,
      text: 'fourth',
      selection: '',
      language: 'text',
    })
    expect(ai.attachedEditor.value?.snippetId).toBe(4)
  })

  it('follows saved items while preserving manually attached records', async () => {
    const { ai, setSnapshot } = await setup()
    setSnapshot(undefined)
    ai.setVaultContext({ type: 'note', id: 7, name: 'Current note' })
    ai.setOpen(true)
    expect(ai.attachments.value).toEqual([
      { type: 'note', id: 7, name: 'Current note' },
    ])
    ai.addAttachment({ type: 'note', id: 10, name: 'Pinned note' })
    ai.setVaultContext({
      type: 'http_request',
      id: 8,
      name: 'Current request',
    })
    expect(ai.attachments.value.map(item => item.id)).toEqual([8, 10])
    ai.removeAttachment(0)
    ai.setOpen(true)
    expect(ai.attachments.value.map(item => item.id)).toEqual([10])
    ai.clearConversation()
    expect(ai.attachments.value).toEqual([
      { type: 'http_request', id: 8, name: 'Current request' },
    ])
  })

  it('waits for the selected item to load before seeding initial context', async () => {
    const { ai, setSnapshot } = await setup()
    setSnapshot(undefined)
    ai.setOpen(true)
    expect(ai.attachments.value).toEqual([])
    ai.setVaultContext({ type: 'note', id: 9, name: 'Loaded note' })
    expect(ai.attachments.value[0]?.id).toBe(9)
  })

  it('captures unsaved selection at send time without attaching the rest of the fragment', async () => {
    const { ai, updateBuffer, request } = await setup()
    updateBuffer({
      text: 'private surrounding text',
      selection: 'const live = 3;',
    })
    ai.contextMode.value = 'selection'
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

  it('keeps a streaming conversation when switching records or leaving the editor', async () => {
    const { ai, request, emit, setSnapshot, invoke } = await setup()
    await ai.send('First question')
    const old = request()
    emit({ requestId: old.requestId, type: 'delta', text: 'Partial A' })
    setSnapshot(undefined)
    expect(invoke).not.toHaveBeenCalledWith(
      'system:ai:cancel',
      expect.anything(),
    )
    emit({ requestId: old.requestId, type: 'delta', text: ' continued' })
    emit({ requestId: old.requestId, type: 'done' })
    expect(ai.conversation.value?.messages.at(-1)?.content).toBe(
      'Partial A continued',
    )
    await ai.send('Second question')
    expect(request().messages[0].content).toBe('First question')
    expect(request().messages.at(-1)?.content).toBe('Second question')
    expect(request().vaultAccess).toBe(true)
    expect(request().editContextId).toBeUndefined()
  })

  it('pins an explicitly attached editor snapshot across navigation', async () => {
    const { ai, request, setSnapshot } = await setup()
    ai.attachEditor('fragment')
    setSnapshot(undefined)
    await ai.send('Explain attached code')
    expect(request().messages[0].content).toContain('const first = 1;')
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
    ai.contextMode.value = 'selection'
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
    ai.contextMode.value = 'selection'
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
      content: message.content.slice(message.toolContent?.length ?? 0),
    })
    expect(message.content).toContain('Example:')
    expect(message.content).toContain('Examples:')
  })
  it('preserves rejected tool history when a later proposal reuses its call ID', async () => {
    const { ai, request, emit } = await setup()
    ai.contextMode.value = 'fragment'
    await ai.send('Fix')
    const proposed = propose(request(), 'const secret = 1', 'const secret = 2')
    emit(proposed)
    const call = proposed.calls[0]
    emit({
      requestId: request().requestId,
      type: 'protocol',
      messages: [
        { role: 'assistant', content: '', tool_calls: [call] },
        {
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify({ status: 'validation_failed' }),
        },
        { role: 'assistant', content: '', tool_calls: [call] },
        {
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify({ status: 'awaiting_user_review' }),
        },
      ],
    })
    emit({
      requestId: request().requestId,
      type: 'delta',
      text: 'Proposal explanation',
    })
    emit({ requestId: request().requestId, type: 'done' })
    const message = ai.conversation.value!.messages.at(-1)!
    message.rejected = true
    await ai.send('Explain')
    const messages = request().messages
    const results = messages.filter(
      (item: { role: string }) => item.role === 'tool',
    )
    expect(JSON.parse(results[0].content).status).toBe('validation_failed')
    expect(JSON.parse(results[1].content).status).toBe('rejected')
    expect(messages.at(-2)?.content).toBe('Proposal explanation')
    expect(ai.conversation.value?.error).toBeUndefined()
    expect(ai.isStreaming.value).toBe(true)
    expect(aiStartSchema.safeParse(request()).success).toBe(true)
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
    ai.contextMode.value = 'selection'
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

it('retains authoritative search cards when intermediate assistant text is reset', async () => {
  const { ai, request, emit } = await setup()
  await ai.send('Find order')
  const result = {
    items: [{ type: 'http_request' as const, id: 469, name: 'Order details' }],
    queries: ['order'],
    total: 1,
    expanded: true,
  }
  emit({ requestId: request().requestId, type: 'searchResults', result })
  emit({ requestId: request().requestId, type: 'answerReset' })
  expect(ai.conversation.value!.messages.at(-1)!.searchResults).toEqual([
    result,
  ])
})

describe('hTTP proposals in chat', () => {
  it('sends the attached live snapshot and gates apply until completion', async () => {
    const { ai, emit, request, setSnapshot } = await setup()
    setSnapshot(undefined)
    const snapshot = {
      baseline: 'draft',
      context: {
        contextId: 'a52a8b2b-09be-42c2-9355-05b89bb86817',
        requestId: 7,
        name: 'HTTP test',
        request: '{}',
        response: null,
        assertions: [],
      },
    }
    const writer = vi.fn(() => true)
    ai.registerHttp(() => snapshot, writer)
    ai.setVaultContext({ type: 'http_request', id: 7, name: 'HTTP test' })
    ai.setOpen(true)
    await ai.send('Add checks')
    expect(request().httpContext).toEqual(snapshot.context)
    const requestId = request().requestId
    const proposal = {
      context_id: snapshot.context.contextId,
      summary: 'Status',
      assertions: [
        {
          name: 'Status',
          source: 'status' as const,
          operator: 'eq' as const,
          expected: 200,
        },
      ],
    }
    emit({ requestId, type: 'httpProposal', proposal })
    const message = ai.conversation.value!.messages.at(-1)!
    expect(ai.canApplyHttp(message)).toBe(false)
    emit({ requestId, type: 'done' })
    expect(ai.applyHttp(message)).toBe(true)
    expect(message.applied).toBe(true)
    expect(ai.applyHttp(message)).toBe(false)
  })
})
