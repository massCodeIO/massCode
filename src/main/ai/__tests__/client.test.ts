import { afterEach, describe, expect, it, vi } from 'vitest'
import { AI_LIMITS } from '../../../shared/ai'
import { listAiModels, readAiStream, streamAiChat } from '../client'

const encoder = new TextEncoder()
function stream(chunks: string[] | Uint8Array[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(
          typeof chunk === 'string' ? encoder.encode(chunk) : chunk,
        )
      }
      controller.close()
    },
  })
}
function delta(text: string) {
  return JSON.stringify({
    choices: [{ delta: { content: text }, finish_reason: null }],
  })
}
const finish = JSON.stringify({
  choices: [{ delta: {}, finish_reason: 'stop' }],
})
afterEach(() => vi.unstubAllGlobals())

describe('aI compatible transport', () => {
  it('decodes Unicode split across byte chunks and split CRLF boundaries', async () => {
    const bytes = encoder.encode(
      `: keepalive\r\ndata: ${delta('Привет 😀')}\r\n\r\ndata: [DONE]\r\n\r\n`,
    )
    const chunks = Array.from(bytes, byte => new Uint8Array([byte]))
    const received: string[] = []
    await readAiStream(stream(chunks), text => received.push(text))
    expect(received.join('')).toBe('Привет 😀')
  })
  it('handles multi-line data and finish event without trailing blank line', async () => {
    const received: string[] = []
    await readAiStream(
      stream([
        `data: ${delta('ok')}\n\ndata: {"choices":\ndata: [{"delta":{},"finish_reason":"stop"}]}`,
      ]),
      text => received.push(text),
    )
    expect(received).toEqual(['ok'])
  })
  it('rejects empty completed answers and renders refusal text', async () => {
    for (const event of ['data: [DONE]\n\n', `data: ${finish}\n\n`]) {
      await expect(
        readAiStream(stream([event]), () => {}),
      ).rejects.toMatchObject({ code: 'invalidResponse' })
    }
    const refusal = JSON.stringify({
      choices: [{ delta: { refusal: 'Cannot help with this request.' } }],
    })
    const received: string[] = []
    await readAiStream(
      stream([`data: ${refusal}\n\ndata: [DONE]\n\n`]),
      text => received.push(text),
    )
    expect(received).toEqual(['Cannot help with this request.'])
  })
  it('rejects a stream that ended before a terminal event', async () => {
    await expect(
      readAiStream(stream([`data: ${delta('partial')}\n\n`]), () => {}),
    ).rejects.toMatchObject({ code: 'invalidResponse' })
  })
  it('rejects malformed data and upstream error events without leaking raw text', async () => {
    await expect(
      readAiStream(
        stream(['data: {"error":"private provider details"}\n\n']),
        () => {},
      ),
    ).rejects.toMatchObject({ message: 'invalidResponse' })
  })
  it('caps unterminated events and cumulative response bytes', async () => {
    await expect(
      readAiStream(
        stream(['data: '.padEnd(AI_LIMITS.eventBytes + 1, 'x')]),
        () => {},
      ),
    ).rejects.toMatchObject({ code: 'outputLimit' })
    const chunks = Array.from(
      { length: 9 },
      () => `data: ${delta('x'.repeat(128 * 1024))}\n\n`,
    )
    await expect(readAiStream(stream(chunks), () => {})).rejects.toMatchObject({
      code: 'outputLimit',
    })
  })
  it('sends only fixed request fields with main-injected system message and rejects redirects', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          stream([`data: ${delta('answer')}\n\ndata: ${finish}\n\n`]),
        ),
      )
    vi.stubGlobal('fetch', fetch)
    await streamAiChat(
      { baseURL: 'http://localhost:1234/v1', model: 'local', apiKey: 'secret' },
      [{ role: 'user', content: 'hello' }],
      new AbortController().signal,
      () => {},
    )
    const [url, options] = fetch.mock.calls[0]
    expect(url).toBe('http://localhost:1234/v1/chat/completions')
    expect(options.redirect).toBe('error')
    expect(options.headers.Authorization).toBe('Bearer secret')
    const body = JSON.parse(options.body)
    expect(Object.keys(body).sort()).toEqual(['messages', 'model', 'stream'])
    expect(body.messages[0].role).toBe('system')
    expect(body.messages[1]).toEqual({ role: 'user', content: 'hello' })
  })
  it('checks byte limits before network and normalizes provider failures', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await expect(
      streamAiChat(
        { baseURL: 'http://localhost/v1', model: 'x' },
        [{ role: 'user', content: 'Я'.repeat(AI_LIMITS.inputBytes) }],
        new AbortController().signal,
        () => {},
      ),
    ).rejects.toMatchObject({ code: 'inputLimit' })
    expect(fetch).not.toHaveBeenCalled()
    fetch.mockResolvedValue(
      new Response('secret key rejected', { status: 401 }),
    )
    await expect(
      listAiModels(
        { baseURL: 'http://localhost/v1', model: '' },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ message: 'authentication' })
  })
  it('validates, deduplicates and sorts model IDs', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ data: [{ id: 'b' }, { id: 'a' }, { id: 'a' }] }),
          ),
        ),
    )
    expect(
      await listAiModels(
        { baseURL: 'http://localhost/v1', model: '' },
        new AbortController().signal,
      ),
    ).toEqual(['a', 'b'])
  })
})

const contextId = '11111111-1111-4111-8111-111111111111'
const args = JSON.stringify({
  context_id: contextId,
  summary: 'Fix',
  edits: [{ old_text: 'a + b', new_text: 'a - b' }],
})
function toolDelta(index: number, argument: string, first = false) {
  return `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index, ...(first ? { id: `call_${index}`, type: 'function' } : {}), function: { ...(first ? { name: 'propose_edit' } : {}), arguments: argument } }] } }] })}\n\n`
}
const toolFinish = `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'tool_calls' }] })}\n\ndata: [DONE]\n\n`

describe('streamed tool calls', () => {
  it('accumulates interleaved calls and accepts tool-only completions', async () => {
    const calls = await readAiStream(
      stream([
        toolDelta(0, args.slice(0, 30), true),
        toolDelta(1, args.slice(0, 10), true),
        toolDelta(0, args.slice(30)),
        toolDelta(1, args.slice(10)),
        toolFinish,
      ]),
      () => {},
    )
    expect(calls).toHaveLength(2)
    expect(calls.map(call => call.function.arguments)).toEqual([args, args])
  })
  it('rejects calls without a successful finish and limits tool bytes', async () => {
    await expect(
      readAiStream(
        stream([toolDelta(0, args, true), 'data: [DONE]\n\n']),
        () => {},
      ),
    ).rejects.toMatchObject({ code: 'invalidResponse' })
    const truncated = `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'length' }] })}\n\n`
    await expect(
      readAiStream(stream([toolDelta(0, args, true), truncated]), () => {}),
    ).rejects.toMatchObject({ code: 'invalidResponse' })
    await expect(
      readAiStream(
        stream(
          Array.from({ length: 12 }, (_, i) =>
            toolDelta(0, 'x'.repeat(100000), i === 0)),
        ),
        () => {},
      ),
    ).rejects.toMatchObject({ code: 'outputLimit' })
  })
  it('sends the tool definition and recovers from malformed arguments or wrong targets', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(stream([toolDelta(0, args, true), toolFinish])),
      )
    vi.stubGlobal('fetch', fetch)
    const run = () =>
      streamAiChat(
        { baseURL: 'http://localhost/v1', model: 'qwen' },
        [{ role: 'user', content: 'Fix' }],
        new AbortController().signal,
        () => {},
        contextId,
      )
    expect(await run()).toHaveLength(1)
    expect(JSON.parse(fetch.mock.calls[0][1].body).tools[0].function.name).toBe(
      'propose_edit',
    )
    for (const invalid of [
      '{',
      args.replace(contextId, '22222222-2222-4222-8222-222222222222'),
    ]) {
      fetch.mockResolvedValueOnce(
        new Response(stream([toolDelta(0, invalid, true), toolFinish])),
      )
      fetch.mockResolvedValueOnce(
        new Response(
          stream([
            `data: ${delta('Here are the examples.')}\n\ndata: ${finish}\n\n`,
          ]),
        ),
      )
      expect(await run()).toEqual([])
    }
  })
})

describe('edit validation feedback', () => {
  it('returns a validation error to the model and accepts one corrected proposal', async () => {
    const wrong = JSON.stringify({
      context_id: contextId,
      summary: 'Fix',
      edits: [{ old_text: 'a+b', new_text: 'a-b' }],
    })
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(stream([toolDelta(0, wrong, true), toolFinish])),
      )
      .mockResolvedValueOnce(
        new Response(stream([toolDelta(0, args, true), toolFinish])),
      )
    vi.stubGlobal('fetch', fetch)
    const result = await streamAiChat(
      { baseURL: 'http://localhost/v1', model: 'qwen' },
      [{ role: 'user', content: 'Fix a + b' }],
      new AbortController().signal,
      () => {},
      contextId,
      'a + b',
    )
    expect(result[0].function.arguments).toBe(args)
    expect(fetch).toHaveBeenCalledTimes(2)
    const feedback = JSON.parse(fetch.mock.calls[1][1].body).messages.find(
      (message: { role: string }) => message.role === 'tool',
    )
    expect(JSON.parse(feedback.content)).toMatchObject({
      status: 'validation_failed',
      reason: 'missing',
      applied: false,
      original_code: 'a + b',
    })
  })
  it('finishes without tools after one rejected correction', async () => {
    const wrong = args.replace('a + b', 'not in original')
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(stream([toolDelta(0, wrong, true), toolFinish])),
      )
      .mockResolvedValueOnce(
        new Response(stream([toolDelta(0, wrong, true), toolFinish])),
      )
      .mockResolvedValueOnce(
        new Response(
          stream([`data: ${delta('Example only')}\n\ndata: ${finish}\n\n`]),
        ),
      )
    vi.stubGlobal('fetch', fetch)
    const received: string[] = []
    expect(
      await streamAiChat(
        { baseURL: 'http://localhost/v1', model: 'qwen' },
        [
          {
            role: 'user',
            content: 'Show examples without changing the snippet',
          },
        ],
        new AbortController().signal,
        text => received.push(text),
        contextId,
        'a + b',
      ),
    ).toEqual([])
    expect(received.join('')).toBe('Example only')
    expect(fetch).toHaveBeenCalledTimes(3)
    const final = JSON.parse(fetch.mock.calls[2][1].body)
    expect(final.tools).toBeUndefined()
    expect(
      final.messages.filter((m: { role: string }) => m.role === 'user'),
    ).toHaveLength(1)
  })
  it('accepts a normal answer after invalid JSON and preserves earlier prose', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          stream([
            `data: ${delta('Let me explain.')}\n\n`,
            toolDelta(0, '{', true),
            toolFinish,
          ]),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          stream([`data: ${delta('Three examples.')}\n\ndata: ${finish}\n\n`]),
        ),
      )
    vi.stubGlobal('fetch', fetch)
    const received: string[] = []
    expect(
      await streamAiChat(
        { baseURL: 'http://localhost/v1', model: 'qwen' },
        [{ role: 'user', content: 'Examples only' }],
        new AbortController().signal,
        text => received.push(text),
        contextId,
        'a + b',
      ),
    ).toEqual([])
    expect(received.join('')).toBe('Let me explain.\n\nThree examples.')
    const retry = JSON.parse(fetch.mock.calls[1][1].body)
    expect(retry.tool_choice).toBe('auto')
    expect(retry.messages.at(-1).role).toBe('tool')
  })
  it('does not issue a correction after cancellation', async () => {
    const controller = new AbortController()
    const fetch = vi.fn().mockImplementation(async () => {
      controller.abort()
      return new Response(stream([toolDelta(0, args, true), toolFinish]))
    })
    vi.stubGlobal('fetch', fetch)
    await expect(
      streamAiChat(
        { baseURL: 'http://localhost/v1', model: 'qwen' },
        [{ role: 'user', content: 'Fix' }],
        controller.signal,
        () => {},
        contextId,
        'different',
      ),
    ).rejects.toBeDefined()
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})

describe('bounded request history', () => {
  it('drops oldest complete turns for repair without discarding the original current turn', async () => {
    const wrong = args.replace('a + b', 'missing')
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(stream([toolDelta(0, wrong, true), toolFinish])),
      )
      .mockResolvedValueOnce(
        new Response(stream([toolDelta(0, args, true), toolFinish])),
      )
    vi.stubGlobal('fetch', fetch)
    const history = Array.from({ length: 19 }, (_, i) => [
      { role: 'user' as const, content: `Old ${i}` },
      { role: 'assistant' as const, content: `Answer ${i}` },
    ]).flat()
    const omitted = vi.fn()
    await streamAiChat(
      { baseURL: 'http://localhost/v1', model: 'qwen' },
      [...history, { role: 'user', content: 'CURRENT a + b' }],
      new AbortController().signal,
      () => {},
      contextId,
      'a + b',
      1,
      history.length,
      omitted,
    )
    const repair = JSON.parse(fetch.mock.calls[1][1].body).messages.slice(1)
    expect(repair.length).toBeLessThanOrEqual(AI_LIMITS.messages)
    expect(repair[0]).toMatchObject({ role: 'user', content: 'Old 1' })
    expect(
      repair.some(
        (message: { content: string }) => message.content === 'CURRENT a + b',
      ),
    ).toBe(true)
    expect(
      repair.some((message: { role: string }) => message.role === 'tool'),
    ).toBe(true)
    expect(omitted).toHaveBeenCalledOnce()
  })

  it('fails oversized repair rather than dropping its original code context', async () => {
    const wrong = args.replace('a + b', 'missing')
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(stream([toolDelta(0, wrong, true), toolFinish])),
      )
    vi.stubGlobal('fetch', fetch)
    const code = 'я'.repeat(70000)
    await expect(
      streamAiChat(
        { baseURL: 'http://localhost/v1', model: 'qwen' },
        [{ role: 'user', content: code }],
        new AbortController().signal,
        () => {},
        contextId,
        code,
      ),
    ).rejects.toMatchObject({ code: 'inputLimit' })
    expect(fetch).toHaveBeenCalledOnce()
  })
})

describe('unsupported tools', () => {
  it('retries without tools only for an explicit capability rejection', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { code: 'unsupported_parameter', param: 'tools' },
          }),
          { status: 400 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          stream([`data: ${delta('Example')}\n\ndata: ${finish}\n\n`]),
        ),
      )
    vi.stubGlobal('fetch', fetch)
    const run = () =>
      streamAiChat(
        { baseURL: 'http://localhost/v1', model: 'local' },
        [{ role: 'user', content: 'Explain' }],
        new AbortController().signal,
        () => {},
        contextId,
        'a + b',
      )
    expect(await run()).toEqual([])
    expect(JSON.parse(fetch.mock.calls[1][1].body).tools).toBeUndefined()
    fetch.mockClear()
    fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: 'invalid_request' } }), {
        status: 400,
      }),
    )
    await expect(run()).rejects.toMatchObject({ code: 'upstream' })
    expect(fetch).toHaveBeenCalledOnce()
  })
})

describe('vault tool loop', () => {
  it('reads vault data and continues the original conversation without requiring an editor', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          stream([
            `data: ${delta('Searching, maybe an unrelated item')}\n\n`,
            toolDelta(0, '{"query":"QA","type":"all"}', true).replace(
              'propose_edit',
              'search_vault',
            ),
            toolFinish,
          ]),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          stream([
            toolDelta(0, '{"type":"note","id":2}', true).replace(
              'propose_edit',
              'read_vault_item',
            ),
            toolFinish,
          ]),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          stream([`data: ${delta('Found QA note')}\n\ndata: ${finish}\n\n`]),
        ),
      )
    vi.stubGlobal('fetch', fetch)
    const execute = vi
      .fn()
      .mockResolvedValue({ name: 'QA note', content: 'document' })
    const response = vi.fn()
    const output: string[] = []
    expect(
      await streamAiChat(
        { baseURL: 'http://localhost/v1', model: 'local' },
        [{ role: 'user', content: 'Find QA' }],
        new AbortController().signal,
        text => output.push(text),
        undefined,
        undefined,
        1,
        0,
        undefined,
        response,
        {
          tools: [],
          execute,
          remaining: 2,
          onToolRound: () => {
            output.length = 0
          },
        },
      ),
    ).toEqual([])
    expect(execute).toHaveBeenCalledTimes(2)
    expect(output.join('')).toBe('Found QA note')
    const final = JSON.parse(fetch.mock.calls[2][1].body)
    expect(final.tools).toBeUndefined()
    expect(
      final.messages.filter((m: { role: string }) => m.role === 'tool'),
    ).toHaveLength(2)
    expect(
      final.messages.some((m: { content?: string }) =>
        m.content?.includes('Searching, maybe an unrelated item'),
      ),
    ).toBe(true)
    expect(response).toHaveBeenCalled()
  })
})

it('requires the planned HTTP tool and does not accept prose as completed action', async () => {
  const fetch = vi.fn(
    async () =>
      new Response(
        stream([`data: ${delta('Here are some tests')}\n\ndata: [DONE]\n\n`]),
      ),
  )
  vi.stubGlobal('fetch', fetch)
  await expect(
    streamAiChat(
      { baseURL: 'http://localhost:1234/v1', model: 'test' },
      [{ role: 'user', content: 'Add checks' }],
      new AbortController().signal,
      () => {},
      undefined,
      undefined,
      1,
      undefined,
      undefined,
      undefined,
      {
        tools: [
          { type: 'function', function: { name: 'propose_http_assertions' } },
        ],
        remaining: 2,
        requiredTool: () => 'propose_http_assertions',
        execute: vi.fn(),
      },
    ),
  ).rejects.toMatchObject({ code: 'proposalUnavailable' })
  const options = (fetch.mock.calls[0] as unknown as [string, RequestInit])[1]
  expect(JSON.parse(options.body as string).tool_choice).toBe('required')
})

it('finishes a validated proposal without asking the model to invent a second summary', async () => {
  const payload = JSON.stringify({
    choices: [
      {
        delta: {
          tool_calls: [
            {
              index: 0,
              id: 'call_http',
              type: 'function',
              function: { name: 'propose_http_assertions', arguments: '{}' },
            },
          ],
        },
        finish_reason: 'tool_calls',
      },
    ],
  })
  const fetch = vi.fn(
    async () => new Response(stream([`data: ${payload}\n\ndata: [DONE]\n\n`])),
  )
  vi.stubGlobal('fetch', fetch)
  const response = vi.fn()
  let complete = false
  const result = {
    status: 'awaiting_user_review',
    applied: false,
    assertions: [{ source: 'json', path: '/id', operator: 'isNumber' }],
  }
  await streamAiChat(
    { baseURL: 'http://localhost/v1', model: 'test' },
    [{ role: 'user', content: 'Add checks' }],
    new AbortController().signal,
    () => {},
    undefined,
    undefined,
    1,
    0,
    undefined,
    response,
    {
      tools: [
        { type: 'function', function: { name: 'propose_http_assertions' } },
      ],
      remaining: 3,
      isComplete: () => complete,
      execute: async () => {
        complete = true
        return result
      },
    },
  )
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(response).toHaveBeenCalledWith(
    [
      { role: 'user', content: 'Add checks' },
      expect.objectContaining({
        role: 'assistant',
        tool_calls: expect.any(Array),
      }),
      {
        role: 'tool',
        tool_call_id: 'call_http',
        content: JSON.stringify(result),
      },
    ],
    '',
  )
})
