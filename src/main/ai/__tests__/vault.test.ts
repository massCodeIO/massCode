import { describe, expect, it, vi } from 'vitest'
import { executeVaultTool, readVaultItem, searchVault } from '../vault'

const data = vi.hoisted(() => ({
  extraHttp: [] as {
    id: number
    name: string
    updatedAt: number
    isDeleted: number
  }[],
  snippet: {
    id: 1,
    name: 'QA code',
    isDeleted: 0,
    contents: [{ id: 1, value: 'const x = 1', language: 'javascript' }],
  },
  note: { id: 2, name: 'QA note', isDeleted: 0, content: 'Documentation' },
  http: {
    id: 3,
    name: 'QA request Order details',
    isDeleted: 0,
    method: 'GET',
    url: 'https://example.test',
    headers: [
      { key: 'Authorization', value: 'secret' },
      { key: 'Accept', value: 'application/json' },
    ],
    query: [],
    protocol: 'http',
    formData: [
      { key: 'password', type: 'text', value: 'saved-secret' },
      { key: 'token', type: 'text', value: 'saved-secret' },
      { key: 'ordinary', type: 'text', value: 'kept' },
    ],
    bodyType: 'multipart',
    body: null,
    description: 'Endpoint',
    auth: { token: 'secret' },
    filePath: '/private/path',
  },
}))
vi.mock('../../store', () => ({
  store: { preferences: { get: () => '/vault' } },
}))
vi.mock('../../storage', () => ({
  useStorage: () => ({
    snippets: {
      getSnippets: (filter: { search?: string }) =>
        [data.snippet].filter(
          item =>
            !filter.search
            || `${item.name} ${item.contents[0].value}`
              .toLowerCase()
              .includes(filter.search.toLowerCase()),
        ),
      getSnippetById: () => data.snippet,
    },
  }),
  useNotesStorage: () => ({
    notes: {
      getNotes: (filter: { search?: string }) =>
        [data.note].filter(
          item =>
            !filter.search
            || `${item.name} ${item.content}`
              .toLowerCase()
              .includes(filter.search.toLowerCase()),
        ),
      getNoteById: () => data.note,
    },
  }),
  useHttpStorage: () => ({
    requests: {
      getRequests: (filter: { search?: string }) =>
        [data.http, ...data.extraHttp].filter(
          item =>
            !filter.search
            || item.name.toLowerCase().includes(filter.search.toLowerCase()),
        ),
      getRequestById: () => data.http,
    },
  }),
}))
it('searches the three spaces without returning record bodies', async () => {
  const items = await searchVault({ query: 'QA', type: 'all' })
  expect(items.map(item => item.type)).toEqual([
    'snippet',
    'note',
    'http_request',
  ])
  expect(JSON.stringify(items)).not.toContain('const x')
})
it('reads saved definitions without HTTP execution, auth or file paths', () => {
  const record = readVaultItem({ type: 'http_request', id: 3 })
  expect(JSON.stringify(record)).not.toContain('secret')
  expect(JSON.stringify(record)).not.toContain('/private/path')
  expect(record.content).toMatchObject({
    method: 'GET',
    headers: [{ key: 'Accept', value: 'application/json' }],
  })
})
describe('unavailable data', () => {
  it('rejects trash and oversized content without truncation', async () => {
    data.note.isDeleted = 1
    expect(
      await executeVaultTool(
        'read_vault_item',
        JSON.stringify({ type: 'note', id: 2 }),
      ),
    ).toEqual({ error: 'NOT_FOUND' })
    data.note.isDeleted = 0
    data.note.content = 'x'.repeat(50000)
    expect(() => readVaultItem({ type: 'note', id: 2 })).toThrow(
      'CONTENT_TOO_LARGE',
    )
    data.note.content = 'Documentation'
  })
  it('returns bounded errors for malformed arguments and unknown tools', async () => {
    expect(await executeVaultTool('search_vault', '{')).toEqual({
      error: 'INVALID_ARGUMENTS',
    })
    expect(await executeVaultTool('execute_http_request', '{}')).toEqual({
      error: 'UNKNOWN_TOOL',
    })
  })
})

it('reports an empty literal search without asserting the record is absent and supports translated retries', async () => {
  const first = await executeVaultTool(
    'search_vault',
    JSON.stringify({ query: 'заказ', type: 'http_request' }),
  )
  expect(first).toMatchObject({
    status: 'no_matches',
    queries: ['заказ'],
    items: [],
    total: 0,
  })
  const retry = await executeVaultTool(
    'search_vault',
    JSON.stringify({ query: 'order', type: 'http_request' }),
  )
  expect(retry).toMatchObject({
    items: [{ id: 3, name: 'QA request Order details' }],
  })
})

it('ranks exact names above newer partial and URL-only matches before limiting results', async () => {
  data.extraHttp = Array.from({ length: 35 }, (_, i) => ({
    id: 100 + i,
    name: 'Order details archive',
    updatedAt: 1000 + i,
    isDeleted: 0,
  }))
  data.extraHttp.push({
    id: 99,
    name: 'Order details',
    updatedAt: 1,
    isDeleted: 0,
  })
  try {
    const items = await searchVault({
      query: 'order details',
      type: 'http_request',
    })
    expect(items).toHaveLength(30)
    expect(items[0]).toMatchObject({ id: 99, name: 'Order details' })
  }
  finally {
    data.extraHttp = []
  }
})

it('retrieves multilingual variants with stable ranking and excludes URL scheme distractors', async () => {
  const { retrieveVaultItems } = await import('../vault')
  data.extraHttp = Array.from({ length: 40 }, (_, i) => ({
    id: 100 + i,
    name: 'Get a post',
    updatedAt: 1000 + i,
    isDeleted: 0,
  }))
  data.extraHttp.push({
    id: 469,
    name: 'Order details',
    updatedAt: 1,
    isDeleted: 0,
  })
  try {
    const found = await retrieveVaultItems('http_request', [
      'детали заказа',
      'order details',
      'order',
    ])
    expect(found.items.map(item => item.id)).toEqual([469, 3])
    expect(found.total).toBe(2)
    expect(found.items[0]).toMatchObject({
      matchedField: 'name',
      matchedQuery: 'order details',
    })
    expect((await retrieveVaultItems('http_request', ['http'])).items).toEqual(
      [],
    )
    expect((await retrieveVaultItems('http_request', [''])).items).toEqual([])
    expect(
      (await retrieveVaultItems('http_request', ['payment receipt'])).items,
    ).toEqual([])
    expect((await retrieveVaultItems('note', ['order details'])).items).toEqual(
      [],
    )
    expect(
      (await retrieveVaultItems('http_request', ['details order'])).items[0].id,
    ).toBe(469)
  }
  finally {
    data.extraHttp = []
  }
})

it('preserves content search and exact names containing function words', async () => {
  const { retrieveVaultItems } = await import('../vault')
  expect(
    (await retrieveVaultItems('snippet', ['const x'])).items[0],
  ).toMatchObject({ id: 1, matchedField: 'stored_text' })
  expect(
    (await retrieveVaultItems('note', ['Documentation'])).items[0].id,
  ).toBe(2)
  data.extraHttp = [
    { id: 50, name: 'Create an order', updatedAt: 1, isDeleted: 0 },
    { id: 51, name: 'Create order helper', updatedAt: 2, isDeleted: 0 },
  ]
  try {
    expect(
      (await retrieveVaultItems('http_request', ['Create an order'])).items[0]
        .id,
    ).toBe(50)
    expect(
      (await retrieveVaultItems('http_request', ['with order details']))
        .items[0].id,
    ).toBe(3)
  }
  finally {
    data.extraHttp = []
  }
})

it('distinguishes C++ and C# names', async () => {
  const { retrieveVaultItems } = await import('../vault')
  data.extraHttp = [
    { id: 50, name: 'C++ example', updatedAt: 1, isDeleted: 0 },
    { id: 51, name: 'C# example', updatedAt: 2, isDeleted: 0 },
  ]
  try {
    expect(
      (await retrieveVaultItems('http_request', ['C++'])).items.map(
        item => item.id,
      ),
    ).toEqual([50])
    expect(
      (await retrieveVaultItems('http_request', ['C#'])).items.map(
        item => item.id,
      ),
    ).toEqual([51])
  }
  finally {
    data.extraHttp = []
  }
})

it('redacts saved multipart credentials in the actual read tool result', async () => {
  const result = await executeVaultTool(
    'read_vault_item',
    JSON.stringify({ type: 'http_request', id: 3 }),
  )
  expect(JSON.stringify(result)).not.toContain('saved-secret')
  expect(result).toMatchObject({
    content: {
      formData: [
        { key: 'password', value: '[REDACTED]' },
        { key: 'token', value: '[REDACTED]' },
        { key: 'ordinary', value: 'kept' },
      ],
    },
  })
})
