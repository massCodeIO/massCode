import { afterEach, expect, it, vi } from 'vitest'
import { AI_DEFAULT_URLS, AI_PROVIDERS } from '../../../shared/ai'
import { streamAiChat } from '../client'
import { createHttpTools } from '../httpTools'
import { wireResponse } from './fixtures/aiWire'

const context = {
  contextId: 'a52a8b2b-09be-42c2-9355-05b89bb86817',
  requestId: 1,
  name: 'Synthetic replay',
  request: '{"method":"GET"}',
  response: '{"status":200,"body":"{\\"id\\":42}"}',
  assertions: [],
}
const proposal = {
  context_id: context.contextId,
  summary: 'Check id',
  analysis: null,
  evidence: [],
  assertions: [
    {
      name: 'ID is numeric',
      source: 'json',
      path: '/id',
      operator: 'isNumber',
      expected: null,
    },
  ],
}
afterEach(() => vi.unstubAllGlobals())
it.each(AI_PROVIDERS)(
  '%s replays read → invalid proposal → repair → review without applying',
  async (provider) => {
    const fetcher = vi
      .fn()
      .mockImplementationOnce(async () =>
        wireResponse(
          provider,
          true,
          'read_http_context',
          { part: 'response' },
          'read12345',
        ),
      )
      .mockImplementationOnce(async () =>
        wireResponse(
          provider,
          true,
          'propose_http_assertions',
          { ...proposal, context_id: 'c82462c7-9f15-44ac-9014-01b9d5b5e2c9' },
          'bad123456',
        ),
      )
      .mockImplementationOnce(async () =>
        wireResponse(
          provider,
          true,
          'propose_http_assertions',
          proposal,
          'ok1234567',
        ),
      )
    vi.stubGlobal('fetch', fetcher)
    const review = vi.fn()
    const http = createHttpTools(context, review, ['Check id is numeric'])
    const original = JSON.stringify(context)
    const execute = vi.fn(async (name: string, args: string) =>
      http.execute(name, args),
    )
    let protocol: unknown
    await streamAiChat(
      {
        provider,
        baseURL: AI_DEFAULT_URLS[provider],
        model: 'test',
        apiKey: 'synthetic',
      },
      [{ role: 'user', content: 'Check id is numeric' }],
      new AbortController().signal,
      () => {},
      undefined,
      undefined,
      1,
      0,
      undefined,
      (messages) => {
        protocol = messages
      },
      {
        tools: http.tools,
        execute,
        remaining: 5,
        requiredTool: http.requiredTool,
        isComplete: http.hasProposal,
      },
    )
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(review).toHaveBeenCalledTimes(1)
    expect(review.mock.calls[0][0].assertions).toEqual([
      {
        name: 'ID is numeric',
        source: 'json',
        path: '/id',
        operator: 'isNumber',
      },
    ])
    expect(JSON.stringify(protocol)).toContain('INVALID_CONTEXT_OR_LIMIT')
    expect(JSON.stringify(protocol)).toContain('awaiting_user_review')
    expect(JSON.stringify(context)).toBe(original)
    const thirdRequest = JSON.parse(fetcher.mock.calls[2][1].body)
    expect(JSON.stringify(thirdRequest)).toContain('INVALID_CONTEXT_OR_LIMIT')
  },
)
