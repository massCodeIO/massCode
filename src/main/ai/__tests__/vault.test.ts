import { describe, expect, it, vi } from 'vitest'
import { executeVaultTool, readVaultItem, searchVault } from '../vault'

const data = vi.hoisted(() => ({
  snippet: {
    id: 1,
    name: 'QA code',
    isDeleted: 0,
    contents: [{ id: 1, value: 'const x = 1', language: 'javascript' }],
  },
  note: { id: 2, name: 'QA note', isDeleted: 0, content: 'Documentation' },
  http: {
    id: 3,
    name: 'QA request',
    isDeleted: 0,
    method: 'GET',
    url: 'https://example.test',
    headers: [
      { key: 'Authorization', value: 'secret' },
      { key: 'Accept', value: 'application/json' },
    ],
    query: [],
    bodyType: 'none',
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
      getSnippets: () => [data.snippet],
      getSnippetById: () => data.snippet,
    },
  }),
  useNotesStorage: () => ({
    notes: { getNotes: () => [data.note], getNoteById: () => data.note },
  }),
  useHttpStorage: () => ({
    requests: {
      getRequests: () => [data.http],
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
