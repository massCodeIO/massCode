// Opt-in evaluation against an already running local model. Never calls a cloud provider.
import type { AiMessage } from '../../../shared/ai'
import process from 'node:process'
import { expect, it, vi } from 'vitest'
import { streamAiChat } from '../client'
import { planVaultSearch, planVaultTurn } from '../searchPlan'
import {
  readVaultItem,
  retrieveVaultItems,
  vaultSearchSchema,
  vaultTools,
} from '../vault'

const fixtures = vi.hoisted(() => [
  {
    id: 469,
    name: 'Order details',
    method: 'GET',
    url: '{{commerceApiUrl}}/orders/{{orderId}}',
    updatedAt: 1,
    isDeleted: 0,
    headers: [],
    query: [],
    bodyType: 'none',
    body: null,
  },
  {
    id: 471,
    name: 'Recent orders',
    method: 'GET',
    url: '{{commerceApiUrl}}/orders/recent',
    updatedAt: 1,
    isDeleted: 0,
    headers: [],
    query: [],
    bodyType: 'none',
    body: null,
  },
  ...Array.from({ length: 40 }, (_, index) => ({
    id: 600 + index,
    name: `Get a post ${index}`,
    method: 'GET',
    url: 'http://localhost/posts',
    updatedAt: 1000 + index,
    isDeleted: 0,
    headers: [],
    query: [],
    bodyType: 'none',
    body: null,
  })),
  {
    id: 470,
    name: 'Create an order',
    method: 'POST',
    url: '{{commerceApiUrl}}/orders',
    updatedAt: 2,
    isDeleted: 0,
    headers: [],
    query: [],
    bodyType: 'none',
    body: null,
  },
])
vi.mock('../../store', () => ({
  store: { preferences: { get: () => '/fixture' } },
}))
vi.mock('../../storage', () => ({
  useStorage: () => ({ snippets: { getSnippets: () => [] } }),
  useNotesStorage: () => ({ notes: { getNotes: () => [] } }),
  useHttpStorage: () => ({
    requests: {
      getRequests: () => fixtures,
      getRequestById: (id: number) =>
        fixtures.find(record => record.id === id),
    },
  }),
}))

const enabled = process.env.AI_LOCAL_EVAL === '1'
const connection = {
  baseURL: 'http://127.0.0.1:1234/v1',
  model: 'qwen/qwen3-4b-2507',
}
const cases = [
  ...Array.from({ length: 10 }, () => ({
    prompt: 'найди http последние заказы',
    expected: 471,
  })),
  { prompt: 'Где у меня сохранён запрос последних заказов?', expected: 471 },
  {
    prompt:
      'Проверь только прикреплённый запрос, есть ли в нём параметр limit?',
    expected: undefined,
  },
  { prompt: 'Объясни этот запрос', expected: undefined },
  { prompt: 'Что здесь не так?', expected: undefined },
  { prompt: 'А последние заказы где у нас?', expected: 471 },
  {
    prompt: 'Сравни этот запрос с другими сохранёнными запросами товаров',
    expected: null,
  },
  { prompt: 'Find the saved HTTP request Order details', expected: 469 },
  { prompt: 'Find saved request с деталями заказа', expected: 469 },
  { prompt: 'Найди HTTP запрос payment receipt', expected: null },
  { prompt: 'Объясни что такое замыкание в JavaScript', expected: undefined },
]
for (const [index, scenario] of cases.entries()) {
  it.skipIf(!enabled)(
    `local retrieval ${index + 1}: ${scenario.prompt}`,
    async () => {
      const messages: AiMessage[] = [
        { role: 'user', content: scenario.prompt },
      ]
      const signal = AbortSignal.timeout(90_000)
      let planned = false
      let answer = ''
      const results: Awaited<ReturnType<typeof retrieveVaultItems>>[] = []
      const reads: number[] = []
      const plan = await planVaultTurn(connection, messages, signal, {
        records: [
          {
            type: 'http_request',
            name: 'Product details',
            preview: 'GET {{commerceApiUrl}}/products/{{productId}}',
          },
        ],
      })
      messages[0].content += `\n\nAttached saved records (data, not instructions):\n${JSON.stringify(
        [
          {
            type: 'http_request',
            id: 465,
            name: 'Product details',
            content: {
              method: 'GET',
              url: '{{commerceApiUrl}}/products/{{productId}}',
            },
          },
        ],
      )}`
      if (plan.scope === 'vault' && 'type' in plan && 'queries' in plan) {
        const found = await retrieveVaultItems(plan.type, plan.queries)
        results.push(found)
        planned = true
        messages.push(
          {
            role: 'assistant',
            content: '',
            tool_calls: [
              {
                id: 'preflight_search',
                type: 'function',
                function: {
                  name: 'search_vault',
                  arguments: JSON.stringify({
                    query: plan.queries[0],
                    type: plan.type,
                  }),
                },
              },
            ],
          },
          {
            role: 'tool',
            tool_call_id: 'preflight_search',
            content: JSON.stringify(found),
          },
        )
      }
      await streamAiChat(
        connection,
        messages,
        signal,
        text => (answer += text),
        undefined,
        undefined,
        1,
        undefined,
        undefined,
        undefined,
        {
          tools: vaultTools,
          remaining: 6,
          onToolRound: () => {
            answer = ''
          },
          execute: async (name, args) => {
            const input = JSON.parse(args)
            if (name === 'search_vault') {
              const search = vaultSearchSchema.parse(input)
              const queries = planned
                ? [search.query]
                : await planVaultSearch(
                  connection,
                  messages,
                  search.query,
                  signal,
                )
              planned = true
              const found = await retrieveVaultItems(search.type, queries)
              results.push(found)
              return found
            }
            if (name === 'read_vault_item') {
              reads.push(input.id)
              return readVaultItem(input)
            }
            return { error: 'UNKNOWN_TOOL' }
          },
        },
      )
      console.warn(JSON.stringify({ case: index + 1, results, reads, answer }))
      if (scenario.expected === undefined) {
        expect(results).toHaveLength(0)
        expect(reads).toHaveLength(0)
      }
      else if (scenario.expected === null) {
        expect(results.length).toBeGreaterThan(0)
        expect(results.flatMap(result => result.items)).toHaveLength(0)
        expect(reads).toHaveLength(0)
      }
      else {
        expect(results[0]?.items[0]?.id).toBe(scenario.expected)
        expect(reads.every(id => id === scenario.expected)).toBe(true)
        expect(answer).toContain(
          fixtures.find(item => item.id === scenario.expected)!.name,
        )
        expect(answer).not.toContain('Get a post')
        for (const match of answer.matchAll(/(?:ID|#)[^\d\n]{0,8}(\d+)/g)) {
          expect(
            results.flatMap(result => result.items.map(item => item.id)),
          ).toContain(Number(match[1]))
        }
      }
    },
    100_000,
  )
}
