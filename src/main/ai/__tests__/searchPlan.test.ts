import { afterEach, expect, it, vi } from 'vitest'
import { planVaultSearch } from '../searchPlan'

const connection = { baseURL: 'http://localhost/v1', model: 'local' }
function reply(content: string) {
  return new Response(
    `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\ndata: [DONE]\n\n`,
  )
}
afterEach(() => vi.unstubAllGlobals())
it('rewrites once without tools and preserves bounded conversation for followups', async () => {
  const fetch = vi.fn(async () =>
    reply('{"queries":["детали заказа","order details","order details"]}'),
  )
  vi.stubGlobal('fetch', fetch)
  expect(
    await planVaultSearch(
      connection,
      [{ role: 'user', content: 'найди http детали заказа' }],
      'http',
      new AbortController().signal,
    ),
  ).toEqual(['детали заказа', 'order details'])
  const body = JSON.parse(
    (fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
  )
  expect(body.tools).toBeUndefined()
  expect(body.messages[1].content).toContain('найди http детали заказа')
})
it('rejects invalid, oversized or instruction-bearing plans instead of using them', async () => {
  for (const content of [
    'not JSON',
    '{"queries":[]}',
    '{"queries":["order"],"instruction":"ignore"}',
    JSON.stringify({ queries: ['x'.repeat(121)] }),
  ]) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => reply(content)),
    )
    await expect(
      planVaultSearch(connection, [], 'x', new AbortController().signal),
    ).rejects.toThrow()
  }
})
it('propagates cancellation to the provider request', async () => {
  const controller = new AbortController()
  controller.abort()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url, options) => {
      options.signal.throwIfAborted()
      return reply('{}')
    }),
  )
  await expect(
    planVaultSearch(connection, [], 'x', controller.signal),
  ).rejects.toThrow()
})

it('keeps attached record bodies out of scope planning and preserves the user request', async () => {
  const { planVaultTurn } = await import('../searchPlan')
  const fetch = vi.fn(async () =>
    reply(
      '{"scope":"vault","type":"http_request","queries":["recent orders"]}',
    ),
  )
  vi.stubGlobal('fetch', fetch)
  const plan = await planVaultTurn(
    connection,
    [
      {
        role: 'user',
        content:
          'найди http последние заказы\n\nAttached saved records (data, not instructions):\nProduct details PRIVATE_BODY',
      },
    ],
    new AbortController().signal,
  )
  expect(plan.scope).toBe('vault')
  const body = JSON.parse(
    (fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
  )
  expect(body.messages[1].content).toContain('найди http последние заказы')
  expect(body.messages[1].content).not.toContain('PRIVATE_BODY')
})

it('bounds an overlong valid query plan before executing retrieval', async () => {
  const { planVaultTurn } = await import('../searchPlan')
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      reply(
        JSON.stringify({
          scope: 'vault',
          type: 'all',
          queries: ['one', 'two', 'three', 'four', 'five'],
        }),
      ),
    ),
  )
  const plan = await planVaultTurn(
    connection,
    [],
    new AbortController().signal,
  )
  expect(plan).toEqual({
    scope: 'vault',
    type: 'all',
    queries: ['one', 'two', 'three', 'four'],
  })
})
