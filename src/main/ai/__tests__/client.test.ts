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
