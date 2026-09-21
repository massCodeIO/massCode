// Opt-in evaluation against a local model; never sends vault or private user data.
import type { AiHttpProposal } from '../../../shared/aiHttp'
import process from 'node:process'
import { afterEach, expect, it, vi } from 'vitest'
import { streamAiChat } from '../client'
import { createHttpTools } from '../httpTools'
import { planVaultTurn } from '../searchPlan'

const originalFetch = globalThis.fetch
afterEach(() => vi.unstubAllGlobals())

const context = {
  contextId: 'a52a8b2b-09be-42c2-9355-05b89bb86817',
  requestId: 1,
  name: 'Get order',
  request: JSON.stringify({ method: 'GET', url: 'http://localhost/orders/42' }),
  response: JSON.stringify({
    status: 200,
    headers: [{ key: 'Content-Type', value: 'application/json' }],
    body: '{"id":42,"status":"paid","items":[]}',
    durationMs: 24,
  }),
  assertions: [],
}
for (const prompt of [
  'Разбери последний response и добавь проверки',
  'Накидай тесты на этот ответ',
  'Add checks that id is numeric and items is an array',
]) {
  it.skipIf(process.env.AI_LOCAL_EVAL !== '1')(
    prompt,
    async () => {
      let proposal: AiHttpProposal | undefined
      vi.stubGlobal('fetch', async (...args: Parameters<typeof fetch>) => {
        const response = await originalFetch(...args)
        if (!response.ok)
          console.error(await response.clone().text())
        return response
      })
      const tools = createHttpTools(context, (value) => {
        proposal = value
      })
      const connection = {
        baseURL: 'http://127.0.0.1:1234/v1',
        model: 'qwen/qwen3-4b-2507',
      }
      const plan = await planVaultTurn(
        connection,
        [{ role: 'user', content: prompt }],
        AbortSignal.timeout(90000),
        { records: [], httpAvailable: true },
      )
      expect(plan.httpAction).toBe('assertions')
      const calls: string[] = []
      const exchange: unknown[] = []
      let answer = ''
      await streamAiChat(
        { baseURL: 'http://127.0.0.1:1234/v1', model: 'qwen/qwen3-4b-2507' },
        [
          {
            role: 'user',
            content: `${prompt}\nHTTP editor context available: ${JSON.stringify({ context_id: context.contextId, name: context.name, responseAvailable: true })}. Use read_http_context for unsaved request and last response; saved vault records do not contain this state. Use propose_http_assertions to suggest checks for user review.`,
          },
        ],
        AbortSignal.timeout(90000),
        (text) => {
          answer += text
        },
        undefined,
        undefined,
        1,
        undefined,
        undefined,
        undefined,
        {
          tools: tools.tools,
          requiredTool: tools.requiredTool,
          remaining: 6,
          onToolRound: () => {},
          execute: async (name, args) => {
            calls.push(name)
            const result = tools.execute(name, args)
            exchange.push({ name, args, result })
            return result
          },
        },
      )
      if (!proposal)
        console.error(JSON.stringify({ prompt, exchange, answer }))
      expect(calls).toContain('read_http_context')
      expect(proposal?.assertions.length).toBeGreaterThan(0)
      expect(proposal?.context_id).toBe(context.contextId)
    },
    100000,
  )
}

for (const prompt of [
  'Почему здесь 401?',
  'Просто объясни этот ответ, ничего не меняй',
  'Покажи пример теста на JavaScript, без изменения запроса',
]) {
  it.skipIf(process.env.AI_LOCAL_EVAL !== '1')(
    `analysis only: ${prompt}`,
    async () => {
      const plan = await planVaultTurn(
        { baseURL: 'http://127.0.0.1:1234/v1', model: 'qwen/qwen3-4b-2507' },
        [{ role: 'user', content: prompt }],
        AbortSignal.timeout(90000),
        { records: [], httpAvailable: true },
      )
      expect(plan.httpAction).toBe('answer')
    },
    100000,
  )
}

it.skipIf(process.env.AI_LOCAL_EVAL !== '1')(
  'assesses existing HTTP coverage using actual response',
  async () => {
    const prompt = 'нужны ли тесты для этого запроса еще?'
    const connection = {
      baseURL: 'http://127.0.0.1:1234/v1',
      model: 'qwen/qwen3-4b-2507',
    }
    const plan = await planVaultTurn(
      connection,
      [{ role: 'user', content: prompt }],
      AbortSignal.timeout(90000),
      { records: [], httpAvailable: true },
    )
    expect(plan.httpAction).toBe('answer')
    const propose = vi.fn()
    const tools = createHttpTools(
      {
        ...context,
        assertions: [
          { name: 'HTTP 200', source: 'status', operator: 'eq', expected: 200 },
          {
            name: 'Order is paid',
            source: 'json',
            path: '/status',
            operator: 'eq',
            expected: 'paid',
          },
          {
            name: 'Items is an array',
            source: 'json',
            path: '/items',
            operator: 'isArray',
          },
        ],
      },
      propose,
    )
    const messages: import('../../../shared/ai').AiMessage[] = [
      { role: 'user', content: prompt },
    ]
    for (const part of ['request', 'response']) {
      const args = JSON.stringify({ part })
      messages.push(
        {
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              id: part,
              type: 'function',
              function: { name: 'read_http_context', arguments: args },
            },
          ],
        },
        {
          role: 'tool',
          tool_call_id: part,
          content: JSON.stringify(tools.execute('read_http_context', args)),
        },
      )
    }
    let answer = ''
    await streamAiChat(
      connection,
      messages,
      AbortSignal.timeout(90000),
      text => (answer += text),
      undefined,
      undefined,
      1,
      undefined,
      undefined,
      undefined,
      {
        tools: tools.tools.filter(
          tool => tool.function.name === 'read_http_context',
        ),
        remaining: 4,
        execute: async (name, args) =>
          name === 'read_http_context'
            ? tools.execute(name, args)
            : { error: 'ACTION_NOT_REQUESTED' },
      },
    )
    console.warn(answer)
    expect(propose).not.toHaveBeenCalled()
    expect(answer).toContain('paid')
    expect(answer).not.toMatch(
      /responseAvailable|context_id|propose_http_assertions|"success"/,
    )
  },
  100000,
)
