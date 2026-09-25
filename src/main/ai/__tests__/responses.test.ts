import { afterEach, expect, it, vi } from 'vitest'
import { aiMessageSchema } from '../../../shared/ai'
import { budgetAiHistory } from '../../../shared/aiHistory'
import { generateAiResponse, streamAiChat } from '../client'
import { readResponsesStream, responsesInput } from '../responses'
import { planVaultSearch } from '../searchPlan'

const connection = {
  provider: 'openai' as const,
  baseURL: 'https://api.openai.com/v1',
  model: 'any-model',
}
const encoder = new TextEncoder()
const reasoning = {
  type: 'reasoning' as const,
  id: 'rs1',
  summary: [],
  encrypted_content: 'opaque',
  extra_protocol_field: 'preserved',
}
const call = {
  type: 'function_call',
  id: 'fc1',
  call_id: 'call1',
  name: 'read_vault_item',
  arguments: '{"id":1}',
}
function message(text: string) {
  return {
    type: 'message',
    id: 'msg1',
    role: 'assistant',
    status: 'completed',
    phase: 'final_answer',
    content: [{ type: 'output_text', text, annotations: [] }],
  }
}
function sse(events: unknown[], split = false) {
  const bytes = encoder.encode(
    events.map(event => `data: ${JSON.stringify(event)}\r\n\r\n`).join(''),
  )
  return new ReadableStream<Uint8Array>({
    start(controller) {
      if (split) {
        for (const byte of bytes) controller.enqueue(new Uint8Array([byte]))
      }
      else {
        controller.enqueue(bytes)
      }
      controller.close()
    },
  })
}
function completed(output: unknown[]) {
  return {
    type: 'response.completed',
    response: {
      status: 'completed',
      output,
      usage: { input_tokens: 12, output_tokens: 4, total_tokens: 16 },
    },
  }
}
afterEach(() => vi.unstubAllGlobals())
it('reads split UTF-8, preserves phase/reasoning and returns completed function calls once', async () => {
  const parts: string[] = []
  const result = await readResponsesStream(
    sse(
      [
        { type: 'response.output_text.delta', delta: 'Привет 😀' },
        { type: 'response.function_call_arguments.delta', delta: '{"id":' },
        {
          type: 'response.function_call_arguments.done',
          arguments: '{"id":1}',
        },
        completed([reasoning, message('Привет 😀'), call]),
      ],
      true,
    ),
    connection.model,
    text => parts.push(text),
  )
  expect(parts.join('')).toBe('Привет 😀')
  expect(result.calls).toEqual([
    {
      id: 'call1',
      type: 'function',
      function: { name: 'read_vault_item', arguments: '{"id":1}' },
    },
  ])
  expect(result.replay.items).toEqual([reasoning, message('Привет 😀'), call])
  expect(result.usage?.total_tokens).toBe(16)
})
it.each([
  [{ type: 'response.failed' }, 'upstream'],
  [{ type: 'error' }, 'upstream'],
  [
    {
      type: 'response.incomplete',
      response: { incomplete_details: { reason: 'max_output_tokens' } },
    },
    'outputLimit',
  ],
  [{ type: 'response.output_text.delta', delta: 'partial' }, 'invalidResponse'],
])('fails closed without completed output: %j', async (event, code) => {
  await expect(
    readResponsesStream(sse([event]), connection.model, () => {}),
  ).rejects.toMatchObject({ code })
})
it('converts input without duplicating native items and checks call correlation', () => {
  const assistant = aiMessageSchema.parse({
    role: 'assistant',
    content: 'done',
    tool_calls: [
      {
        id: 'call1',
        type: 'function',
        function: { name: call.name, arguments: call.arguments },
      },
    ],
    openaiResponse: {
      model: connection.model,
      items: [reasoning, message('done'), call],
    },
  })
  expect(
    responsesInput(
      [assistant, { role: 'tool', tool_call_id: 'call1', content: '{}' }],
      connection.model,
    ),
  ).toEqual([
    reasoning,
    message('done'),
    call,
    { type: 'function_call_output', call_id: 'call1', output: '{}' },
  ])
  expect(
    aiMessageSchema.safeParse({ ...assistant, tool_calls: [] }).success,
  ).toBe(false)
  expect(
    JSON.stringify(responsesInput([assistant], 'other-model')),
  ).not.toContain('opaque')
  expect(
    budgetAiHistory(
      [
        { role: 'user', content: 'old' },
        assistant,
        { role: 'user', content: 'new' },
      ],
      2,
    ).fits,
  ).toBe(true)
})
it('uses Responses for planner and preserves optional tool schemas without disabling reasoning', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(
    async () =>
      new Response(sse([completed([message('{"queries":["orders"]}')])])),
  )
  vi.stubGlobal('fetch', fetch)
  await expect(
    planVaultSearch(connection, [], 'orders', new AbortController().signal),
  ).resolves.toEqual(['orders'])
  expect(fetch.mock.calls[0][0]).toBe('https://api.openai.com/v1/responses')
  const payload = JSON.parse(fetch.mock.calls[0][1]!.body as string)
  expect(payload.store).toBe(false)
  expect(payload.reasoning).toBeUndefined()
  expect(payload.messages).toBeUndefined()
})
it('replays native reasoning through a real tool round and final callback', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response(sse([completed([reasoning, call])])))
    .mockResolvedValueOnce(new Response(sse([completed([message('Found')])])))
  vi.stubGlobal('fetch', fetch)
  const onResponse = vi.fn()
  const execute = vi.fn(async () => ({ name: 'record' }))
  await streamAiChat(
    connection,
    [{ role: 'user', content: 'find record' }],
    new AbortController().signal,
    () => {},
    undefined,
    undefined,
    1,
    undefined,
    undefined,
    onResponse,
    {
      tools: [
        {
          type: 'function',
          function: { name: call.name, parameters: { type: 'object' } },
        },
      ],
      remaining: 2,
      execute,
    },
  )
  const first = JSON.parse(fetch.mock.calls[0][1].body)
  const second = JSON.parse(fetch.mock.calls[1][1].body)
  expect(first.tools[0]).toMatchObject({
    type: 'function',
    name: call.name,
    strict: false,
  })
  expect(second.input).toContainEqual(reasoning)
  expect(second.input).toContainEqual({
    type: 'function_call_output',
    call_id: 'call1',
    output: '{"name":"record"}',
  })
  expect(execute).toHaveBeenCalledOnce()
  expect(onResponse.mock.calls[0][2].items[0].phase).toBe('final_answer')
})
it('never sends native OpenAI state to a local provider', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(
    async () =>
      new Response(
        'data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n',
      ),
  )
  vi.stubGlobal('fetch', fetch)
  await generateAiResponse(
    { ...connection, provider: 'lmstudio', baseURL: 'http://localhost/v1' },
    {
      instructions: 'hi',
      messages: [
        {
          role: 'assistant',
          content: 'prior',
          openaiResponse: { model: connection.model, items: [reasoning] },
        },
      ],
      operation: 'chat',
      signal: new AbortController().signal,
      onDelta: () => {},
    },
  )
  expect(JSON.stringify(fetch.mock.calls)).not.toContain('opaque')
})

it('preserves strict tool contracts when adapting to the Responses API', async () => {
  const fetch = vi.fn(
    async () => new Response(sse([completed([message('ok')])])),
  )
  vi.stubGlobal('fetch', fetch)
  const parameters = {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false,
  }
  await generateAiResponse(connection, {
    instructions: 'test',
    messages: [{ role: 'user', content: 'test' }],
    tools: [
      {
        type: 'function',
        function: { name: 'strict_tool', strict: true, parameters },
      },
    ],
    operation: 'chat',
    signal: new AbortController().signal,
    onDelta: () => {},
  })
  const payload = JSON.parse(
    (fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
  )
  expect(payload.tools).toEqual([
    { type: 'function', name: 'strict_tool', strict: true, parameters },
  ])
})

it('accepts aggregated terminal events above the delta event limit', async () => {
  const text = 'a'.repeat(270000)
  const result = await readResponsesStream(
    sse([
      { type: 'response.output_text.done', text },
      completed([message(text)]),
    ]),
    connection.model,
    () => {},
  )
  expect(result.replay.items).toEqual([message(text)])
})
