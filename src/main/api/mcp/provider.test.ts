import { Buffer } from 'node:buffer'
import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { resetNotesRuntimeCache } from '../../storage/providers/markdown/notes/runtime/sync'
import { createNotesFoldersStorage } from '../../storage/providers/markdown/notes/storages/folders'
import { createNotesNotesStorage } from '../../storage/providers/markdown/notes/storages/notes'
import { resetRuntimeCache } from '../../storage/providers/markdown/runtime/sync'
import { createSnippetsStorage } from '../../storage/providers/markdown/storages/snippets'
import { createMcpRoute } from './route'

let vaultPath = ''
vi.mock('electron', () => ({
  app: { getPath: () => os.tmpdir() },
  BrowserWindow: { getAllWindows: () => [], getFocusedWindow: () => null },
}))
vi.mock('../../store', () => ({
  store: {
    preferences: {
      get: (key: string) =>
        key === 'storage.vaultPath' ? vaultPath : key === 'api.mcp.enabled',
    },
  },
}))
vi.mock('../integrations/auth', () => ({
  isIntegrationTokenAuthorized: () => true,
}))
vi.mock('../../storage', () => ({
  useStorage: () => ({ snippets: createSnippetsStorage() }),
  useNotesStorage: () => ({ notes: createNotesNotesStorage() }),
}))

beforeEach(() => {
  vaultPath = fs.mkdtempSync(path.join(os.tmpdir(), 'masscode-mcp-'))
  resetRuntimeCache()
  resetNotesRuntimeCache()
})
afterEach(() => {
  vi.restoreAllMocks()
  resetRuntimeCache()
  resetNotesRuntimeCache()
  fs.removeSync(vaultPath)
})

it('reports the persisted note ID when backlink rewriting fails during creation', async () => {
  const notes = createNotesNotesStorage()
  const folder = createNotesFoldersStorage().createFolder({
    name: 'Folder',
    parentId: null,
  })
  notes.createNote({ name: 'Foo', folderId: folder.id })
  const linker = notes.createNote({ name: 'Linker', folderId: folder.id })
  notes.updateNoteContent(linker.id, 'See [[Foo]]')
  const writeFile = fs.writeFileSync
  vi.spyOn(fs, 'writeFileSync').mockImplementation((...args) => {
    if (String(args[0]).endsWith('/Linker.md')) {
      throw new Error('EACCES: private linker path')
    }
    return writeFile(...args)
  })

  const response = await toolCall('create_note', {
    name: 'Foo',
    content: 'new content',
  })
  expect(response.isError).toBe(true)
  const error = JSON.parse(response.content[0].text)
  expect(error).toMatchObject({
    code: 'PARTIAL_CREATE',
    type: 'note',
    retryable: false,
  })
  expect(error.id).toBeGreaterThan(linker.id)
  expect(response.content[0].text).not.toContain('private linker path')
  expect(notes.getNoteById(error.id)).toMatchObject({
    name: 'Foo',
    content: '',
    folder: null,
  })
  vi.restoreAllMocks()
  resetNotesRuntimeCache()
  expect(notes.getNoteById(error.id)?.name).toBe('Foo')
})

async function toolCall(name: string, args: Record<string, unknown>) {
  const response = await createMcpRoute(4321, 'test').handle(
    new Request('http://localhost:4321/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name, arguments: args },
      }),
    }),
  )
  expect(response.status).toBe(200)
  const text = await response.text()
  const payload = JSON.parse(
    text.startsWith('event:') ? text.split('data: ')[1].trim() : text,
  )
  return payload.result
}

async function call(name: string, args: Record<string, unknown>) {
  const result = await toolCall(name, args)
  expect(result.isError, JSON.stringify(result)).not.toBe(true)
  return JSON.parse(result.content[0].text)
}

it.each([
  'typescript\ninjected',
  'typescript\rinjected',
  '`typescript',
  '\ntypescript',
])(
  'rejects unsafe language %j before creating a vault item',
  async (language) => {
    const response = await toolCall('create_snippet', {
      name: 'Unsafe',
      content: 'const safe = true',
      language,
    })
    expect(response.isError).toBe(true)
    expect(createSnippetsStorage().getSnippets({})).toHaveLength(0)
  },
)

it('preserves a custom language and code after reloading the vault', async () => {
  const content = 'const safe = true\n'
  const snippet = await call('create_snippet', {
    name: 'Custom',
    content,
    language: 'custom-language_v2',
  })
  resetRuntimeCache()
  const stored = await call('get_item', { type: 'snippet', id: snippet.id })
  expect(stored.contents[0]).toMatchObject({
    language: 'custom-language_v2',
    value: content,
  })
})

it.each(['a\r\nb\r\n', 'a\rb\r', '\r', 'a\r\nb\nc\rd\r', 'a\r\n```\r\nb\r'])(
  'preserves exact line endings after reloading snippets and notes: %j',
  async (content) => {
    const snippet = await call('create_snippet', {
      name: 'Line endings snippet',
      content,
    })
    const note = await call('create_note', {
      name: 'Line endings note',
      content,
    })
    resetRuntimeCache()
    resetNotesRuntimeCache()
    expect(
      (await call('get_item', { type: 'snippet', id: snippet.id })).contents[0]
        .value,
    ).toBe(content)
    expect(
      (await call('get_item', { type: 'note', id: note.id })).content,
    ).toBe(content)
  },
)

it('persists Inbox items through the real Markdown providers and finds their full text after cache reset', async () => {
  const content = '  uniqueMcpContent\n\n```typescript\nconst x = 1\n```\n  '
  const snippet = await call('create_snippet', { name: 'Snippet', content })
  const note = await call('create_note', { name: 'Note', content })
  resetRuntimeCache()
  resetNotesRuntimeCache()
  const storedSnippet = await call('get_item', {
    type: 'snippet',
    id: snippet.id,
  })
  const storedNote = await call('get_item', { type: 'note', id: note.id })
  expect(storedSnippet.folder).toBeNull()
  expect(storedSnippet.contents).toHaveLength(1)
  expect(storedSnippet.contents[0].value).toBe(content)
  expect(storedNote.folder).toBeNull()
  expect(storedNote.content).toBe(content)
  const search = await call('search', { query: 'uniqueMcpContent' })
  expect(
    search.items.map((item: { type: string }) => item.type).sort(),
  ).toEqual(['note', 'snippet'])
})

it.each([
  ['ASCII', 'x'],
  ['Unicode', 'я'],
  ['newlines', '\n'],
  ['quotes', '"'],
  ['control characters', '\u0001'],
])(
  'round-trips 256 KiB of %s through creation and reading after cache reset',
  async (_name, unit) => {
    const content = unit.repeat((256 * 1024) / Buffer.byteLength(unit, 'utf8'))
    const snippet = await call('create_snippet', {
      name: 'Boundary snippet',
      content,
    })
    const note = await call('create_note', { name: 'Boundary note', content })
    resetRuntimeCache()
    resetNotesRuntimeCache()
    expect(
      (await call('get_item', { type: 'snippet', id: snippet.id })).contents[0]
        .value,
    ).toBe(content)
    expect(
      (await call('get_item', { type: 'note', id: note.id })).content,
    ).toBe(content)
  },
)
