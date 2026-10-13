import { describe, expect, it, vi } from 'vitest'
import { executeVaultTool, readVaultItem, searchVault } from '../vault'

const data = vi.hoisted(() => ({
  extraHttp: [] as {
    id: number
    name: string
    updatedAt: number
    isDeleted: number
    url?: string
    description?: string
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
const searchIndex = vi.hoisted(() => vi.fn())
vi.mock('../settings', () => ({}))
// Смысловой поиск выключен: ассистент ищет по словам и именам настоящим searchVault.
vi.mock('../semantic/embeddings', () => ({
  currentSemanticKey: () => undefined,
}))
vi.mock('../semantic/searchVault', async (importOriginal) => {
  const original
    = await importOriginal<typeof import('../semantic/searchVault')>()
  searchIndex.mockImplementation(original.searchVault)
  return { ...original, searchVault: searchIndex }
})
// Сигнатура меняется вместе с записью: корпус перечитывает правки фикстур между тестами.
function signatures(records: { id: number, isDeleted: number }[]) {
  return new Map(
    records
      .filter(record => !record.isDeleted)
      .map(record => [
        record.id,
        { sig: JSON.stringify(record), pendingCloudDownload: false },
      ]),
  )
}
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
      getSnippetSignatures: () => signatures([data.snippet]),
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
      getNoteSignatures: () => signatures([data.note]),
    },
  }),
  useHttpStorage: () => ({
    folders: { getFolders: () => [] },
    requests: {
      getRequests: (filter: { search?: string }) =>
        [data.http, ...data.extraHttp].filter(
          item =>
            !filter.search
            || item.name.toLowerCase().includes(filter.search.toLowerCase()),
        ),
      getRequestById: () => data.http,
      getRequestSignatures: () => signatures([data.http, ...data.extraHttp]),
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

it('reports meaning-only hits as semantic evidence below an exact name', async () => {
  const { retrieveVaultItems } = await import('../vault')
  const hit = (id: number, name: string, score: number, reason: string) => ({
    ref: `http_request:${id}`,
    type: 'http_request',
    id,
    name,
    score,
    reason,
  })
  searchIndex.mockResolvedValueOnce({
    items: [
      hit(60, 'List invoices', 9, 'meaning'),
      hit(3, 'billing documents', 2, 'name'),
    ],
    strongCount: 2,
    meaning: 'ready',
  })
  const found = await retrieveVaultItems('http_request', ['billing documents'])
  expect(searchIndex).toHaveBeenLastCalledWith({
    query: 'billing documents',
    types: ['http_request'],
    mode: 'full',
  })
  expect(found.items).toEqual([
    expect.objectContaining({ id: 3, matchedField: 'name' }),
    expect.objectContaining({
      id: 60,
      matchedField: 'semantic',
      matchedQuery: 'billing documents',
    }),
  ])
})

it('keeps the best result of a record across query variants and drops the weak tail', async () => {
  const { retrieveVaultItems } = await import('../vault')
  const hit = (id: number, score: number, reason = 'words') => ({
    ref: `note:${id}`,
    type: 'note',
    id,
    name: `Note ${id}`,
    score,
    reason,
    coverage: 0.5,
    textCoverage: 0.5,
    weak: false,
  })
  searchIndex
    .mockResolvedValueOnce({
      items: [
        hit(1, 1),
        hit(2, 0.4),
        { ...hit(3, 3.2, 'meaning'), weak: true },
      ],
      strongCount: 1,
      meaning: 'ready',
    })
    .mockResolvedValueOnce({
      items: [hit(1, 3, 'both')],
      strongCount: 1,
      meaning: 'ready',
    })
  const found = await retrieveVaultItems('note', ['first', 'second'])
  expect(found.items).toEqual([
    expect.objectContaining({
      id: 1,
      matchedQuery: 'second',
      matchedField: 'stored_text',
      score: 300,
    }),
  ])
  expect(found.total).toBe(1)
})

it('gives the assistant the best folded meaning hits when nothing literal matched', async () => {
  const { retrieveVaultItems } = await import('../vault')
  const weak = (id: number, score: number) => ({
    ref: `note:${id}`,
    type: 'note',
    id,
    name: `Note ${id}`,
    score,
    reason: 'meaning',
    coverage: 0,
    textCoverage: 0,
    weak: true,
  })
  searchIndex.mockResolvedValueOnce({
    items: [
      weak(1, 3.4),
      weak(2, 3.1),
      weak(3, 2.9),
      weak(4, 2.7),
      weak(5, 2.2),
    ],
    strongCount: 0,
    meaning: 'ready',
  })
  const found = await retrieveVaultItems('note', ['rate limiting'])
  expect(found.items.map(item => [item.id, item.matchedField])).toEqual([
    [1, 'semantic'],
    [2, 'semantic'],
    [3, 'semantic'],
  ])
  searchIndex.mockResolvedValueOnce({
    items: [weak(5, 2.2)],
    strongCount: 0,
    meaning: 'ready',
  })
  expect((await retrieveVaultItems('note', ['qwe'])).status).toBe('no_matches')
})

it('puts a dotted or hyphenated exact name first whichever way it is typed', async () => {
  const { retrieveVaultItems } = await import('../vault')
  data.extraHttp = [
    { id: 70, name: 'docker-compose.yml', updatedAt: 1, isDeleted: 0 },
    {
      id: 71,
      name: 'Docker compose yml cheatsheet for local stacks',
      updatedAt: 2,
      isDeleted: 0,
    },
  ]
  try {
    for (const query of ['docker compose yml', 'docker-compose.yml']) {
      expect(
        (await retrieveVaultItems('http_request', [query])).items[0],
      ).toMatchObject({
        id: 70,
        matchedField: 'name',
        matchedQuery: query,
      })
    }
  }
  finally {
    data.extraHttp = []
  }
})

it('keeps an exact name that a strong meaning hit folded away', async () => {
  const { retrieveVaultItems } = await import('../vault')
  const { strongCount } = await import('../semantic/score')
  const items = [
    {
      ref: 'note:60',
      type: 'note',
      id: 60,
      name: 'Invoices overview',
      score: 10,
      reason: 'meaning',
      coverage: 0,
      textCoverage: 0,
    },
    {
      ref: 'note:61',
      type: 'note',
      id: 61,
      name: 'Billing',
      score: 2,
      reason: 'name',
      coverage: 1,
      textCoverage: 1,
    },
  ]
  const folded = strongCount(
    items.map(item => ({ ...item, z: 0, nameScore: 0 })) as never,
  )
  expect(folded).toBe(1)
  searchIndex.mockResolvedValueOnce({
    items,
    strongCount: folded,
    meaning: 'ready',
  })
  const found = await retrieveVaultItems('note', ['billing'])
  expect(found.items.map(item => [item.id, item.matchedField])).toEqual([
    [61, 'name'],
    [60, 'semantic'],
  ])
})

it('adds folded records that contain every query word, up to the limit', async () => {
  const { retrieveVaultItems } = await import('../vault')
  const hit = (id: number, score: number, coverage: number) => ({
    ref: `note:${id}`,
    type: 'note',
    id,
    name: `Note ${id}`,
    score,
    reason: 'words',
    coverage,
    textCoverage: coverage,
  })
  searchIndex.mockResolvedValueOnce({
    items: [hit(1, 10, 1), hit(2, 1, 1), hit(3, 1.2, 0.5)],
    strongCount: 1,
    meaning: 'ready',
  })
  const found = await retrieveVaultItems('note', ['retry jitter'])
  expect(found.items.map(item => item.id)).toEqual([1, 2])
  expect(found.total).toBe(2)
})

it('searches the original text of codes and paths', async () => {
  const { retrieveVaultItems } = await import('../vault')
  await retrieveVaultItems('all', [
    'ERR_CONNECTION_REFUSED',
    ' /api/users ',
    'err connection refused',
  ])
  expect(
    searchIndex.mock.calls.slice(-2).map(([input]) => input.query),
  ).toEqual(['ERR_CONNECTION_REFUSED', '/api/users'])
})

it('reports url_path only when a query word is in the HTTP path', async () => {
  const { retrieveVaultItems } = await import('../vault')
  data.extraHttp = [
    {
      id: 80,
      name: 'Fetch users',
      updatedAt: 1,
      isDeleted: 0,
      url: 'https://x.test/api/accounts?key=1',
      description: 'Loads profiles',
    },
  ]
  try {
    expect(
      (await retrieveVaultItems('http_request', ['accounts'])).items[0],
    ).toMatchObject({ id: 80, matchedField: 'url_path' })
    expect(
      (await retrieveVaultItems('http_request', ['profiles'])).items[0],
    ).toMatchObject({ id: 80, matchedField: 'stored_text' })
  }
  finally {
    data.extraHttp = []
  }
})

it('marks a record found only through its folder name as folder evidence', async () => {
  const { retrieveVaultItems } = await import('../vault')
  searchIndex.mockResolvedValueOnce({
    items: [
      {
        ref: 'note:7',
        type: 'note',
        id: 7,
        name: 'Schedule bucket',
        score: 1,
        reason: 'words',
        coverage: 1,
        textCoverage: 0,
        weak: false,
      },
    ],
    strongCount: 1,
    meaning: 'ready',
  })
  expect(
    (await retrieveVaultItems('note', ['background jobs'])).items[0],
  ).toMatchObject({ id: 7, matchedField: 'folder' })
})

it('adds folded meaning hits when the strong part has only meaning hits', async () => {
  const { retrieveVaultItems } = await import('../vault')
  const item = (id: number, score: number, weak: boolean) => ({
    ref: `note:${id}`,
    type: 'note',
    id,
    name: `Note ${id}`,
    score,
    reason: 'meaning',
    coverage: 0,
    textCoverage: 0,
    weak,
  })
  searchIndex.mockResolvedValueOnce({
    items: [item(1, 4.2, false), item(2, 3.1, true), item(3, 2.2, true)],
    strongCount: 1,
    meaning: 'ready',
  })
  const found = await retrieveVaultItems('note', ['quiet on-call'])
  expect(found.items.map(found => [found.id, found.matchedField])).toEqual([
    [1, 'semantic'],
    [2, 'semantic'],
  ])
})

it('reports a name match when every query word is in the name but not at its start', async () => {
  const { retrieveVaultItems } = await import('../vault')
  searchIndex.mockResolvedValueOnce({
    items: [
      {
        ref: 'note:5',
        type: 'note',
        id: 5,
        name: 'QA request Order details',
        score: 1,
        reason: 'words',
        coverage: 1,
        textCoverage: 1,
        weak: false,
      },
    ],
    strongCount: 1,
    meaning: 'ready',
  })
  expect(
    (await retrieveVaultItems('note', ['details order'])).items[0],
  ).toMatchObject({ id: 5, matchedField: 'name' })
})
