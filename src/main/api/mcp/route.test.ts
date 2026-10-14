import { Buffer } from 'node:buffer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PartialCreateError } from '../../storage/partialCreateError'
import { createApiApp } from '../app'
import { createMcpRoute } from './route'

const context = vi.hoisted(() => ({
  enabled: true,
  allowEdits: true,
  send: vi.fn(),
  snippets: {
    getSnippets: vi.fn(),
    getSnippetsAsync: vi.fn(),
    getSnippetById: vi.fn(),
    createSnippet: vi.fn(),
    createSnippetContent: vi.fn(),
  },
  requests: {
    getRequests: vi.fn(() => []),
    getRequestById: vi.fn(),
    updateRequest: vi.fn(),
  },
  folders: {
    getFolders: vi.fn(),
    createFolder: vi.fn(),
    updateFolder: vi.fn(),
    deleteFolder: vi.fn(),
  },
  notes: {
    getNotes: vi.fn(),
    getNotesAsync: vi.fn(),
    getNoteById: vi.fn(),
    createNote: vi.fn(),
    updateNoteContent: vi.fn(),
  },
}))

vi.mock('electron', () => ({
  app: {},
  BrowserWindow: {
    getAllWindows: () => [{ webContents: { send: context.send } }],
  },
}))
vi.mock('../../store', () => ({
  store: {
    preferences: {
      get: (key: string) =>
        key === 'api.mcp.enabled'
          ? context.enabled
          : key === 'api.mcp.allowEdits' && context.allowEdits,
    },
  },
}))
vi.mock('../integrations/auth', () => ({
  isIntegrationTokenAuthorized: (header: string) =>
    header === 'Bearer integration-token',
}))
vi.mock('../../storage', () => ({
  useStorage: () => ({ snippets: context.snippets, folders: context.folders }),
  useNotesStorage: () => ({ notes: context.notes, folders: context.folders }),
  useHttpStorage: () => ({ requests: context.requests }),
}))

function request(
  method: string,
  params = {},
  headers: Record<string, string> = {},
  path = '/mcp',
) {
  return new Request(`http://localhost:4321${path}`, {
    method: 'POST',
    headers: {
      'host': 'localhost:4321',
      'authorization': 'Bearer integration-token',
      'content-type': 'application/json',
      'accept': 'application/json, text/event-stream',
      ...headers,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
}

async function rpc(method: string, params = {}) {
  const response = await createMcpRoute(4321, 'test').handle(
    request(method, params),
  )
  const text = await response.text()
  expect(response.status, text).toBe(200)
  return JSON.parse(
    text.startsWith('event:') ? text.split('data: ')[1].trim() : text,
  )
}

async function call(name: string, args: Record<string, unknown>) {
  const response = await rpc('tools/call', { name, arguments: args })
  return {
    ...response.result,
    data: JSON.parse(response.result.content[0].text),
  }
}

const base = {
  id: 1,
  name: 'Example',
  description: null,
  tags: [],
  folder: null,
  isFavorites: 0,
  isDeleted: 0,
  createdAt: 1,
  updatedAt: 2,
}

beforeEach(() => {
  vi.resetAllMocks()
  context.enabled = true
  context.allowEdits = true
  context.snippets.getSnippetsAsync.mockResolvedValue([
    {
      ...base,
      contents: [
        { id: 1, label: 'one', language: 'typescript', value: 'secret body' },
      ],
    },
  ])
  context.notes.getNotesAsync.mockResolvedValue([
    { ...base, content: 'secret note', properties: {} },
  ])
  context.snippets.getSnippetById.mockReturnValue({
    ...base,
    contents: [
      { id: 1, label: 'one', language: 'plain_text', value: '  snippet\n' },
    ],
  })
  context.notes.getNoteById.mockReturnValue({
    ...base,
    content: '  note\n',
    properties: {},
  })
  context.snippets.createSnippet.mockReturnValue({ id: 11 })
  context.notes.createNote.mockReturnValue({ id: 12 })
  context.notes.updateNoteContent.mockReturnValue({
    invalidInput: false,
    notFound: false,
  })
})

describe('mCP protocol and tools', () => {
  it('initializes and discovers the vault and HTTP tools', async () => {
    const initialized = await rpc('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'test', version: '1' },
    })
    expect(initialized.result.serverInfo).toEqual({
      name: 'massCode',
      version: 'test',
    })
    const listed = await rpc('tools/list')
    expect(
      listed.result.tools.map((tool: { name: string }) => tool.name),
    ).toEqual([
      'search',
      'get_item',
      'list_structure',
      'create_snippet',
      'create_note',
      'update_snippet',
      'update_note',
      'trash_item',
      'get_note_links',
      'list_items',
      'create_folder',
      'update_folder',
      'delete_folder',
      'move_items',
      'restore_item',
      'update_http_request',
      'preview_http_request',
      'list_http_history',
      'get_http_history',
      'list_http_collections',
      'list_http_requests',
      'create_http_collection',
      'create_http_request',
      'execute_http_request',
    ])
    for (const name of ['list_http_collections', 'list_http_requests']) {
      expect(
        listed.result.tools.find((tool: { name: string }) => tool.name === name)
          .annotations,
      ).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      })
    }
  })

  it('searches full text, excludes trash and paginates a deterministic metadata-only merged list', async () => {
    context.notes.getNotesAsync.mockResolvedValue([
      { ...base, content: 'secret', properties: {} },
      { ...base, id: 2, isDeleted: 1, content: 'trash' },
    ])
    const first = await call('search', { query: 'needle', limit: 1 })
    expect(first.data).toMatchObject({
      items: [{ type: 'note', id: 1 }],
      hasMore: true,
      nextOffset: 1,
    })
    expect(JSON.stringify(first.data)).not.toContain('secret')
    const second = await call('search', {
      query: 'needle',
      offset: 1,
      limit: 1,
    })
    expect(second.data).toMatchObject({
      items: [{ type: 'snippet', id: 1, languages: ['typescript'] }],
      hasMore: false,
      nextOffset: null,
    })
    expect(JSON.stringify(second.data)).not.toContain('secret')
    expect(context.snippets.getSnippetsAsync).toHaveBeenCalledWith({
      search: 'needle',
      isDeleted: 0,
    })
    expect(context.notes.getNotesAsync).toHaveBeenCalledWith({
      search: 'needle',
      isDeleted: 0,
    })
  })

  it('disambiguates overlapping IDs and preserves complete content', async () => {
    expect(
      (await call('get_item', { type: 'snippet', id: 1 })).data.contents[0]
        .value,
    ).toBe('  snippet\n')
    expect((await call('get_item', { type: 'note', id: 1 })).data.content).toBe(
      '  note\n',
    )
    context.notes.getNoteById.mockReturnValue({ ...base, isDeleted: 1 })
    expect((await call('get_item', { type: 'note', id: 1 })).data.code).toBe(
      'NOT_FOUND',
    )
    context.notes.getNoteById.mockReturnValue({
      ...base,
      pendingCloudDownload: true,
    })
    expect(
      (await call('get_item', { type: 'note', id: 1 })).data,
    ).toMatchObject({ code: 'CLOUD_FILE_NOT_DOWNLOADED', retryable: true })
  })

  it('creates in Inbox with exact whitespace and broadcasts changes', async () => {
    const content = '  # title\n\n body  \n'
    expect(
      (await call('create_note', { name: 'Note', content })).data,
    ).toMatchObject({ type: 'note', id: 12, folderId: null, createdTags: [] })
    expect(context.notes.createNote).toHaveBeenCalledWith({
      name: 'Note',
      folderId: null,
    })
    expect(context.notes.updateNoteContent).toHaveBeenCalledWith(12, content)
    expect(
      (await call('create_snippet', { name: 'Code', content })).data,
    ).toMatchObject({
      type: 'snippet',
      id: 11,
      folderId: null,
      createdTags: [],
    })
    expect(context.snippets.createSnippetContent).toHaveBeenCalledWith(11, {
      label: 'Code',
      language: 'plain_text',
      value: content,
    })
    expect(context.send).toHaveBeenCalledTimes(2)
  })

  it('reports partial creation without rollback and ignores notification failures', async () => {
    context.notes.updateNoteContent.mockImplementation(() => {
      throw new Error('/private/secret/file')
    })
    const partial = await call('create_note', {
      name: 'Note',
      content: 'text',
    })
    expect(partial.isError).toBe(true)
    expect(partial.data).toMatchObject({
      code: 'PARTIAL_CREATE',
      type: 'note',
      id: 12,
      retryable: false,
    })
    expect(JSON.stringify(partial)).not.toContain('/private')
    expect(context.send).toHaveBeenCalledOnce()
    context.send.mockImplementation(() => {
      throw new Error('window closed')
    })
    expect(
      (await call('create_snippet', { name: 'Code', content: 'text' })).isError,
    ).toBeUndefined()
  })

  it('notifies the UI when the provider fails after persisting the item', async () => {
    context.notes.createNote.mockImplementation(() => {
      throw new PartialCreateError(42, new Error('EACCES: private path'))
    })
    const response = await call('create_note', {
      name: 'Note',
      content: 'text',
    })
    expect(response.data).toMatchObject({
      code: 'PARTIAL_CREATE',
      type: 'note',
      id: 42,
    })
    expect(context.notes.updateNoteContent).not.toHaveBeenCalled()
    expect(context.send).toHaveBeenCalledWith('system:storage-synced')
  })

  it('validates before writes, maps errors safely and rejects large input or output', async () => {
    expect(
      (await call('create_note', { name: '../bad', content: 'text' })).data
        .code,
    ).toBe('INVALID_NAME')
    expect(
      (
        await call('create_note', {
          name: 'Note',
          content: 'й'.repeat(128 * 1024 + 1),
        })
      ).data.code,
    ).toBe('CONTENT_TOO_LARGE')
    expect(context.notes.createNote).not.toHaveBeenCalled()
    context.notes.getNoteById.mockReturnValue({
      ...base,
      content: 'x'.repeat(256 * 1024 + 1),
    })
    expect((await call('get_item', { type: 'note', id: 1 })).data.code).toBe(
      'CONTENT_TOO_LARGE',
    )
    context.notes.createNote.mockImplementation(() => {
      throw new Error('VAULT_HYDRATING: /private/path')
    })
    const unavailable = await call('create_note', {
      name: 'Note',
      content: '',
    })
    expect(unavailable.data).toMatchObject({
      code: 'VAULT_HYDRATING',
      retryable: true,
    })
    expect(JSON.stringify(unavailable)).not.toContain('/private')
  })

  it('explains invalid names with a machine-readable reason', async () => {
    expect(
      (await call('create_note', { name: 'a:b', content: '' })).data,
    ).toMatchObject({
      code: 'INVALID_NAME',
      reason: 'invalidChars',
      invalidChars: [':'],
    })
    expect(
      (await call('create_snippet', { name: '.hidden', content: '' })).data,
    ).toMatchObject({ code: 'INVALID_NAME', reason: 'leadingDot' })
    expect(context.notes.createNote).not.toHaveBeenCalled()
    expect(context.snippets.createSnippet).not.toHaveBeenCalled()
  })

  it.each([
    ['update_note', { id: 1, expectedRevision: 'r', patch: { content: 'x' } }],
    [
      'update_snippet',
      { id: 1, expectedRevision: 'r', patch: { fragment: { content: 'x' } } },
    ],
    [
      'update_http_request',
      { id: 1, expectedRevision: 'r', patch: { url: 'x' } },
    ],
    ['trash_item', { type: 'note', id: 1, expectedRevision: 'r' }],
    ['update_folder', { space: 'notes', id: 1, name: 'x' }],
    ['delete_folder', { space: 'code', id: 1 }],
    ['move_items', { space: 'notes', ids: [1], folderId: null }],
    ['restore_item', { type: 'snippet', id: 1 }],
  ])(
    'rejects %s when editing is disabled without touching storage',
    async (name, args) => {
      context.allowEdits = false
      const response = await call(name, args)
      expect(response.isError).toBe(true)
      expect(response.data.code).toBe('EDITING_DISABLED')
      expect(context.notes.getNoteById).not.toHaveBeenCalled()
      expect(context.snippets.getSnippetById).not.toHaveBeenCalled()
      expect(context.requests.getRequests).not.toHaveBeenCalled()
      expect(context.requests.getRequestById).not.toHaveBeenCalled()
      expect(context.requests.updateRequest).not.toHaveBeenCalled()
      for (const method of Object.values(context.folders)) {
        expect(method).not.toHaveBeenCalled()
      }
      expect(context.send).not.toHaveBeenCalled()
    },
  )

  it('creates folders while editing is disabled', async () => {
    context.allowEdits = false
    context.folders.createFolder.mockReturnValue({ id: 5 })
    context.folders.getFolders.mockReturnValue([
      { id: 5, name: 'New', parentId: null },
    ])
    const response = await call('create_folder', {
      space: 'notes',
      name: 'New',
    })
    expect(response.isError).toBeFalsy()
    expect(response.data).toEqual({
      space: 'notes',
      id: 5,
      name: 'New',
      parentId: null,
    })
    expect(context.folders.createFolder).toHaveBeenCalledWith({
      name: 'New',
      parentId: null,
    })
    expect(context.send).toHaveBeenCalledWith('system:storage-synced')
  })

  it('notifies the UI after a successful update but not after CONFLICT', async () => {
    const { contentRevision } = (
      await call('get_item', { type: 'note', id: 1 })
    ).data
    expect(
      (
        await call('update_note', {
          id: 1,
          expectedRevision: 'stale',
          patch: { content: 'x' },
        })
      ).data.code,
    ).toBe('CONFLICT')
    expect(context.notes.updateNoteContent).not.toHaveBeenCalled()
    expect(context.send).not.toHaveBeenCalled()

    const updated = await call('update_note', {
      id: 1,
      expectedRevision: contentRevision,
      patch: { content: 'x' },
    })
    expect(updated.isError).toBeUndefined()
    expect(context.notes.updateNoteContent).toHaveBeenCalledWith(1, 'x')
    expect(context.send).toHaveBeenCalledWith('system:storage-synced')
  })

  it('counts UTF-8 content across all snippet fragments', async () => {
    const contents = [
      {
        id: 1,
        label: 'one',
        language: 'plain_text',
        value: 'я'.repeat(64 * 1024),
      },
      {
        id: 2,
        label: 'two',
        language: 'plain_text',
        value: 'x'.repeat(128 * 1024),
      },
    ]
    context.snippets.getSnippetById.mockReturnValue({ ...base, contents })
    expect(
      (await call('get_item', { type: 'snippet', id: 1 })).data.contents,
    ).toEqual(contents)
    contents[1].value += 'x'
    expect((await call('get_item', { type: 'snippet', id: 1 })).data.code).toBe(
      'CONTENT_TOO_LARGE',
    )
    expect(
      (
        await call('create_snippet', {
          name: 'Large',
          content: 'x'.repeat(256 * 1024 + 1),
        })
      ).data.code,
    ).toBe('CONTENT_TOO_LARGE')
    expect(context.snippets.createSnippet).not.toHaveBeenCalled()
    context.snippets.getSnippetById.mockReturnValue({
      ...base,
      contents: [
        { id: 1, label: 'empty', language: 'plain_text', value: null },
      ],
    })
    expect(
      (await call('get_item', { type: 'snippet', id: 1 })).data.contents[0]
        .value,
    ).toBeNull()
  })

  it('applies the separate result JSON boundary including metadata', async () => {
    const item = { ...base, content: '', description: '' }
    const overhead = Buffer.byteLength(
      JSON.stringify({
        type: 'note',
        ...item,
        contentRevision: 'x'.repeat(64),
      }),
      'utf8',
    )
    item.description = 'x'.repeat(2 * 1024 * 1024 - overhead)
    context.notes.getNoteById.mockReturnValue(item)
    expect(
      (await call('get_item', { type: 'note', id: 1 })).data.description,
    ).toBe(item.description)
    item.description += 'x'
    expect((await call('get_item', { type: 'note', id: 1 })).data.code).toBe(
      'CONTENT_TOO_LARGE',
    )
  })

  it('lets callers reduce an oversized search page without silently dropping items', async () => {
    const tags = [{ id: 1, name: 'x'.repeat(1024 * 1024) }]
    context.notes.getNotesAsync.mockResolvedValue([
      { ...base, tags, content: '' },
      { ...base, id: 2, tags, content: '' },
    ])
    const response = await call('search', { query: 'x', type: 'note' })
    expect(response.data.code).toBe('CONTENT_TOO_LARGE')
    expect(response.data.message).toContain('Reduce limit')
    expect(
      (await call('search', { query: 'x', type: 'note', limit: 1 })).data,
    ).toMatchObject({ hasMore: true, nextOffset: 1 })
    context.notes.getNotesAsync.mockResolvedValue([
      { ...base, tags: [{ id: 1, name: 'x'.repeat(2 * 1024 * 1024) }] },
    ])
    expect(
      (await call('search', { query: 'x', type: 'note', limit: 1 })).data.code,
    ).toBe('CONTENT_TOO_LARGE')
  })

  it.each([
    { query: '' },
    { query: 'q', offset: -1 },
    { query: 'q', limit: 101 },
  ])('rejects invalid search input %j', async (args) => {
    const response = await rpc('tools/call', {
      name: 'search',
      arguments: args,
    })
    expect(response.result.isError).toBe(true)
    expect(context.snippets.getSnippetsAsync).not.toHaveBeenCalled()
  })
})

describe('mCP endpoint security', () => {
  it('requires explicit opt-in and an integration token, including trailing slash', async () => {
    const app = createApiApp({
      port: 4321,
      sessionToken: 'session',
      version: 'test',
    })
    for (const path of ['/mcp', '/mcp/']) {
      expect(
        (await app.handle(request('tools/list', {}, {}, path))).status,
      ).toBe(200)
      expect(
        (
          await app.handle(
            request(
              'tools/list',
              {},
              { authorization: 'Bearer session' },
              path,
            ),
          )
        ).status,
      ).toBe(401)
      expect(
        (
          await app.handle(
            request('tools/list', {}, { authorization: '' }, path),
          )
        ).status,
      ).toBe(401)
    }
    context.enabled = false
    expect((await app.handle(request('tools/list'))).status).toBe(403)
  })

  it('enforces Host and exact local Origin, without wildcard CORS', async () => {
    const app = createApiApp({
      port: 4321,
      sessionToken: 'session',
      version: 'test',
    })
    expect(
      (await app.handle(request('tools/list', {}, { host: 'evil.test:4321' })))
        .status,
    ).toBe(403)
    for (const origin of [
      'null',
      'https://evil.test',
      'http://localhost:9999',
      'http://localhost:4321/',
    ]) {
      expect(
        (await app.handle(request('tools/list', {}, { origin }))).status,
      ).toBe(403)
    }
    for (const origin of ['http://localhost:4321', 'http://127.0.0.1:4321']) {
      const response = await app.handle(request('tools/list', {}, { origin }))
      expect(response.status).toBe(200)
      expect(response.headers.get('access-control-allow-origin')).not.toBe('*')
    }
  })

  it('bounds actual streamed request bytes and rejects unsupported methods', async () => {
    const app = createMcpRoute(4321, 'test')
    const large = request(
      'tools/call',
      {
        name: 'create_note',
        arguments: { name: 'Note', content: 'x'.repeat(2 * 1024 * 1024) },
      },
      { 'content-length': '1' },
    )
    const response = await app.handle(large)
    expect(response.status).toBe(413)
    expect(context.notes.createNote).not.toHaveBeenCalled()
    for (const method of ['GET', 'DELETE', 'OPTIONS', 'PUT']) {
      const response = await app.handle(
        new Request('http://localhost:4321/mcp', {
          method,
          headers: { authorization: 'Bearer integration-token' },
        }),
      )
      expect(response.status).toBe(405)
    }
  })

  it('accepts exactly 2 MiB of request JSON and rejects one extra byte before a write', async () => {
    const original = request('tools/call', {
      name: 'create_note',
      arguments: { name: 'Note', content: 'small' },
    })
    const text = await original.text()
    const body
      = text + ' '.repeat(2 * 1024 * 1024 - Buffer.byteLength(text, 'utf8'))
    const app = createMcpRoute(4321, 'test')
    expect(
      (
        await app.handle(
          new Request(original.url, {
            method: 'POST',
            headers: original.headers,
            body,
          }),
        )
      ).status,
    ).toBe(200)
    expect(context.notes.createNote).toHaveBeenCalledOnce()
    expect(
      (
        await app.handle(
          new Request(original.url, {
            method: 'POST',
            headers: original.headers,
            body: `${body} `,
          }),
        )
      ).status,
    ).toBe(413)
    expect(context.notes.createNote).toHaveBeenCalledOnce()
  })
})
