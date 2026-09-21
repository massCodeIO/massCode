import { afterEach, expect, it, vi } from 'vitest'
import { AI_DEFAULT_URLS, aiMessageSchema } from '../../../shared/ai'
import { generateAiResponse, listAiModels, streamAiChat } from '../client'
import { sdkMessages } from '../sdk'
import { wireResponse as response } from './fixtures/aiWire'

const providers = [
  'anthropic',
  'gemini',
  'deepseek',
  'mistral',
  'xai',
] as const
const tool = {
  type: 'function',
  function: {
    name: 'read_http_context',
    description: 'Read the response',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
}
afterEach(() => vi.unstubAllGlobals())
it.each(providers)(
  '%s streams and completes a real two-step tool loop',
  async (provider) => {
    const fetcher = vi
      .fn()
      .mockImplementationOnce(async () => response(provider, true))
      .mockImplementationOnce(async () => response(provider))
    vi.stubGlobal('fetch', fetcher)
    const execute = vi.fn(async () => ({ status: 200, body: { id: 42 } }))
    let answer = ''
    let protocol: unknown
    await streamAiChat(
      {
        provider,
        baseURL: AI_DEFAULT_URLS[provider],
        model: 'test',
        apiKey: 'synthetic',
      },
      [{ role: 'user', content: 'Разбери ответ' }],
      new AbortController().signal,
      (text) => {
        answer += text
      },
      undefined,
      undefined,
      1,
      0,
      undefined,
      (messages) => {
        protocol = messages
      },
      { tools: [tool], execute, remaining: 3 },
    )
    expect(answer).toBe('Ответ 😀')
    expect(execute).toHaveBeenCalledExactlyOnceWith('read_http_context', '{}')
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(JSON.stringify(protocol)).toContain('sdkResponse')
    const second = JSON.parse(fetcher.mock.calls[1][1].body)
    expect(JSON.stringify(second)).toContain('42')
    expect(JSON.stringify(second)).not.toContain('openaiResponse')
    if (provider === 'gemini')
      expect(JSON.stringify(second)).toContain('opaque-test-signature')
    expect(fetcher.mock.calls[0][1].redirect).toBe('error')
  },
)
it.each(providers)(
  '%s maps authentication failure without retry or leaking body',
  async (provider) => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: { type: 'authentication_error', message: 'secret-value' },
          }),
          { status: 401, headers: { 'content-type': 'application/json' } },
        ),
    )
    vi.stubGlobal('fetch', fetcher)
    await expect(
      generateAiResponse(
        {
          provider,
          baseURL: AI_DEFAULT_URLS[provider],
          model: 'test',
          apiKey: 'synthetic',
        },
        {
          instructions: 'test',
          messages: [{ role: 'user', content: 'hello' }],
          signal: new AbortController().signal,
          onDelta: () => {},
          operation: 'test',
        },
      ),
    ).rejects.toMatchObject({ code: 'authentication' })
    expect(fetcher).toHaveBeenCalledTimes(1)
  },
)
it('does not send foreign model signatures and validates replay correlation', () => {
  const message = {
    role: 'assistant' as const,
    content: 'Hi',
    sdkResponse: {
      provider: 'gemini' as const,
      model: 'one',
      content: [
        {
          type: 'text' as const,
          text: 'Hi',
          providerOptions: { google: { thoughtSignature: 'opaque' } },
        },
      ],
    },
  }
  expect(aiMessageSchema.safeParse(message).success).toBe(true)
  expect(
    JSON.stringify(
      sdkMessages([message], {
        provider: 'anthropic',
        model: 'one',
        baseURL: '',
      }),
    ),
  ).not.toContain('opaque')
  expect(
    JSON.stringify(
      sdkMessages([message], { provider: 'gemini', model: 'two', baseURL: '' }),
    ),
  ).not.toContain('opaque')
  expect(aiMessageSchema.safeParse({ ...message, role: 'user' }).success).toBe(
    false,
  )
  expect(
    aiMessageSchema.safeParse({
      ...message,
      tool_calls: [
        {
          id: 'a',
          type: 'function',
          function: { name: 'bad', arguments: '{}' },
        },
      ],
    }).success,
  ).toBe(false)
})
it('lists Gemini text models across pages, without putting the key in the URL', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          models: [
            {
              name: 'models/embedding',
              supportedGenerationMethods: ['embedContent'],
            },
            {
              name: 'models/gemini',
              supportedGenerationMethods: ['generateContent'],
            },
          ],
          nextPageToken: 'two',
        }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          models: [
            {
              name: 'models/other',
              supportedGenerationMethods: ['generateContent'],
            },
          ],
        }),
      ),
    )
  vi.stubGlobal('fetch', fetcher)
  expect(
    await listAiModels(
      {
        provider: 'gemini',
        baseURL: AI_DEFAULT_URLS.gemini,
        model: '',
        apiKey: 'synthetic',
      },
      new AbortController().signal,
    ),
  ).toEqual(['gemini', 'other'])
  expect(fetcher.mock.calls[1][0]).toContain('pageToken=two')
  expect(fetcher.mock.calls[0][1].headers['x-goog-api-key']).toBe('synthetic')
})
it('lists Anthropic models using native authentication and pagination', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({ data: [{ id: 'a' }], has_more: true, last_id: 'a' }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [{ id: 'b' }], has_more: false })),
    )
  vi.stubGlobal('fetch', fetcher)
  expect(
    await listAiModels(
      {
        provider: 'anthropic',
        baseURL: AI_DEFAULT_URLS.anthropic,
        model: '',
        apiKey: 'synthetic',
      },
      new AbortController().signal,
    ),
  ).toEqual(['a', 'b'])
  expect(fetcher.mock.calls[1][0]).toContain('after_id=a')
  expect(fetcher.mock.calls[0][1].headers['anthropic-version']).toBe(
    '2023-06-01',
  )
})
it.each(providers)(
  '%s rejects an empty/incomplete stream',
  async (provider) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('data: {}\n\n', {
            headers: { 'content-type': 'text/event-stream' },
          }),
      ),
    )
    await expect(
      generateAiResponse(
        {
          provider,
          baseURL: AI_DEFAULT_URLS[provider],
          model: 'test',
          apiKey: 'synthetic',
        },
        {
          instructions: 'test',
          messages: [{ role: 'user', content: 'hello' }],
          signal: new AbortController().signal,
          onDelta: () => {},
          operation: 'test',
        },
      ),
    ).rejects.toMatchObject({
      code: expect.stringMatching(/^(invalidResponse|upstream)$/),
    })
  },
)
it('never logs SDK raw errors or reasoning signatures', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response('{"error":{"message":"secret-value"}}', { status: 401 }),
    ),
  )
  try {
    await expect(
      generateAiResponse(
        {
          provider: 'deepseek',
          baseURL: AI_DEFAULT_URLS.deepseek,
          model: 'test',
          apiKey: 'synthetic',
        },
        {
          instructions: 'test',
          messages: [{ role: 'user', content: 'hello' }],
          signal: new AbortController().signal,
          onDelta: () => {},
          operation: 'test',
        },
      ),
    ).rejects.toMatchObject({ code: 'authentication' })
    expect(log).not.toHaveBeenCalled()
  }
  finally {
    log.mockRestore()
  }
})
it('cancellation propagates to the provider transport and cannot finish successfully', async () => {
  const controller = new AbortController()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url, init) => {
      controller.abort()
      init.signal.throwIfAborted()
      return response('gemini')
    }),
  )
  await expect(
    generateAiResponse(
      {
        provider: 'gemini',
        baseURL: AI_DEFAULT_URLS.gemini,
        model: 'test',
        apiKey: 'synthetic',
      },
      {
        instructions: 'test',
        messages: [{ role: 'user', content: 'hello' }],
        signal: controller.signal,
        onDelta: () => {},
        operation: 'test',
      },
    ),
  ).rejects.toBeDefined()
})

it.each(providers)(
  '%s rejects valid text cut off before its finish event',
  async (provider) => {
    let wire = await response(provider).text()
    if (provider === 'anthropic')
      wire = wire.slice(0, wire.indexOf('event: message_delta'))
    else if (provider === 'gemini')
      wire = wire.replace(',"finishReason":"STOP"', '')
    else wire = wire.slice(0, wire.indexOf('\n\n') + 2)
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(wire, {
            headers: { 'content-type': 'text/event-stream' },
          }),
      ),
    )
    await expect(
      generateAiResponse(
        {
          provider,
          baseURL: AI_DEFAULT_URLS[provider],
          model: 'test',
          apiKey: 'synthetic',
        },
        {
          instructions: 'test',
          messages: [{ role: 'user', content: 'hello' }],
          signal: new AbortController().signal,
          onDelta: () => {},
          operation: 'test',
        },
      ),
    ).rejects.toMatchObject({ code: 'invalidResponse' })
  },
)
