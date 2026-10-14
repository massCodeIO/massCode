import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetHttpRuntimeCache } from '../../storage/providers/markdown/http/runtime/sync'
import { createHttpFoldersStorage } from '../../storage/providers/markdown/http/storages/folders'
import { createHttpRequestsStorage } from '../../storage/providers/markdown/http/storages/requests'
import { getNotesPaths } from '../../storage/providers/markdown/notes/runtime/constants'
import {
  getNotesRuntimeCache,
  resetNotesRuntimeCache,
} from '../../storage/providers/markdown/notes/runtime/sync'
import { createNotesStorageProvider } from '../../storage/providers/markdown/notes/storages'
import { resetRuntimeCache } from '../../storage/providers/markdown/runtime/sync'
import { createMarkdownStorageProvider } from '../../storage/providers/markdown/storages'
import { createMcpRoute } from './route'

type NotesProvider = ReturnType<typeof createNotesStorageProvider>

let vaultPath = ''
let allowEdits = true
// Мок useNotesStorage каждый раз создаёт новый провайдер, поэтому spy на
// возвращённом объекте не сработает: подменяем методы через эту обёртку.
let wrapNotes = (provider: NotesProvider) => provider
vi.mock('electron', () => ({
  app: { getPath: () => os.tmpdir(), isReady: () => false },
  BrowserWindow: { getAllWindows: () => [], getFocusedWindow: () => null },
}))
vi.mock('../../store', () => ({
  store: {
    preferences: {
      get: (key: string) =>
        key === 'storage.vaultPath'
          ? vaultPath
          : key === 'api.mcp.enabled'
            || (key === 'api.mcp.allowEdits' && allowEdits),
    },
  },
}))
vi.mock('../integrations/auth', () => ({
  isIntegrationTokenAuthorized: () => true,
}))
vi.mock('../../storage', () => ({
  useHttpStorage: () => ({
    folders: createHttpFoldersStorage(),
    requests: createHttpRequestsStorage(),
  }),
  useStorage: () => createMarkdownStorageProvider(),
  useNotesStorage: () => wrapNotes(createNotesStorageProvider()),
}))

const notes = () => createNotesStorageProvider()
const code = () => createMarkdownStorageProvider()

function resetCaches() {
  resetRuntimeCache()
  resetNotesRuntimeCache()
  resetHttpRuntimeCache()
}

beforeEach(() => {
  allowEdits = true
  wrapNotes = provider => provider
  vaultPath = fs.mkdtempSync(path.join(os.tmpdir(), 'masscode-mcp-vault-'))
  resetCaches()
})
afterEach(() => {
  vi.restoreAllMocks()
  resetCaches()
  fs.removeSync(vaultPath)
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
  return {
    isError: payload.result.isError === true,
    data: JSON.parse(payload.result.content[0].text),
  }
}

async function call(name: string, args: Record<string, unknown>) {
  const response = await toolCall(name, args)
  expect(response.isError, JSON.stringify(response.data)).toBe(false)
  return response.data
}

async function failed(name: string, args: Record<string, unknown>) {
  const response = await toolCall(name, args)
  expect(response.isError).toBe(true)
  return response.data
}

function vaultFiles(): Record<string, string> {
  const files: Record<string, string> = {}
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory())
        walk(full)
      else files[full] = fs.readFileSync(full, 'utf8')
    }
  }
  walk(vaultPath)
  return files
}

async function revision(type: string, id: number): Promise<string> {
  return (await call('get_item', { type, id })).contentRevision
}

describe('creating with folders and tags', () => {
  it('creates a note in a folder with case-insensitive tags', async () => {
    const folder = notes().folders.createFolder({
      name: 'Work',
      parentId: null,
    })
    const existing = notes().tags.createTag('Project')
    const created = await call('create_note', {
      name: 'Plan',
      content: 'body',
      folderId: folder.id,
      tags: ['project', 'Idea', 'idea '],
    })
    expect(created).toMatchObject({
      type: 'note',
      name: 'Plan',
      folderId: folder.id,
      createdTags: ['Idea'],
    })
    expect(created.tags).toEqual([
      { id: existing.id, name: 'Project' },
      { id: expect.any(Number), name: 'Idea' },
    ])
    expect(created.contentRevision).toMatch(/^[a-f0-9]{64}$/)
    expect(
      notes()
        .tags.getTags()
        .map(tag => tag.name)
        .sort(),
    ).toEqual(['Idea', 'Project'])
  })

  it('rejects a missing folder without creating anything', async () => {
    const response = await failed('create_snippet', {
      name: 'Orphan',
      content: '',
      folderId: 999,
    })
    expect(response.code).toBe('NOT_FOUND')
    expect(response.message).toContain('list_structure')
    expect(code().snippets.getSnippets({})).toHaveLength(0)
  })

  it('reports name conflicts with the folder name', async () => {
    await call('create_note', { name: 'Same', content: '' })
    expect(
      await failed('create_note', { name: 'same', content: '' }),
    ).toMatchObject({
      code: 'NAME_CONFLICT',
      folderId: null,
      folderName: null,
    })
  })

  it('lists folders and tags of both spaces', async () => {
    const parent = code().folders.createFolder({ name: 'Lib', parentId: null })
    const child = code().folders.createFolder({
      name: 'Utils',
      parentId: parent.id,
    })
    code().tags.createTag('ts')
    notes().folders.createFolder({ name: 'Docs', parentId: null })
    expect(await call('list_structure', { space: 'code' })).toEqual({
      folders: expect.arrayContaining([
        { id: parent.id, name: 'Lib', parentId: null },
        { id: child.id, name: 'Utils', parentId: parent.id },
      ]),
      tags: [{ id: expect.any(Number), name: 'ts' }],
    })
    expect(await call('list_structure', { space: 'notes' })).toEqual({
      folders: [{ id: expect.any(Number), name: 'Docs', parentId: null }],
      tags: [],
    })
  })
})

describe('updating notes', () => {
  it('keeps a stable revision and rejects stale writes', async () => {
    const { id } = await call('create_note', { name: 'Doc', content: 'one' })
    const first = await revision('note', id)
    expect(first).toMatch(/^[a-f0-9]{64}$/)
    resetCaches()
    expect(await revision('note', id)).toBe(first)

    const updated = await call('update_note', {
      id,
      expectedRevision: first,
      patch: { content: 'two' },
    })
    expect(updated.contentRevision).not.toBe(first)
    expect(updated.contentRevision).toBe(await revision('note', id))

    expect(
      await failed('update_note', {
        id,
        expectedRevision: first,
        patch: { content: 'three' },
      }),
    ).toMatchObject({ code: 'CONFLICT' })
    resetCaches()
    expect(notes().notes.getNoteById(id)?.content).toBe('two')
  })

  it('rewrites title links on rename but keeps ID links', async () => {
    const target = await call('create_note', { name: 'Old', content: '' })
    const linker = await call('create_note', {
      name: 'Linker',
      content: `[[Old]] and [[note:${target.id}]]`,
    })
    const renamed = await call('update_note', {
      id: target.id,
      expectedRevision: target.contentRevision,
      patch: { name: 'Fresh' },
    })
    expect(renamed.name).toBe('Fresh')
    const content = notes().notes.getNoteById(linker.id)?.content
    expect(content).toContain('[[Fresh]]')
    expect(content).toContain(`[[note:${target.id}]]`)
    expect(content).not.toContain('[[Old]]')
  })

  it('returns the actual name after a move with a name conflict', async () => {
    const folder = notes().folders.createFolder({
      name: 'Box',
      parentId: null,
    })
    await call('create_note', {
      name: 'Same',
      content: '',
      folderId: folder.id,
    })
    const inbox = await call('create_note', { name: 'Same', content: '' })
    const moved = await call('update_note', {
      id: inbox.id,
      expectedRevision: inbox.contentRevision,
      patch: { folderId: folder.id },
    })
    expect(moved.folderId).toBe(folder.id)
    expect(moved.name).not.toBe('Same')
    expect(notes().notes.getNoteById(inbox.id)?.name).toBe(moved.name)
  })

  it('reports a partial update when content fails after a rename', async () => {
    const note = await call('create_note', { name: 'Draft', content: 'old' })
    const writeFile = fs.writeFileSync
    vi.spyOn(fs, 'writeFileSync').mockImplementation((...args) => {
      if (String(args[1]).includes('NEW BODY')) {
        throw new Error('EACCES: /private/path')
      }
      return writeFile(...args)
    })
    const response = await failed('update_note', {
      id: note.id,
      expectedRevision: note.contentRevision,
      patch: { name: 'Final', content: 'NEW BODY' },
    })
    vi.restoreAllMocks()
    expect(response).toMatchObject({
      code: 'PARTIAL_UPDATE',
      type: 'note',
      id: note.id,
      applied: ['metadata'],
      failed: 'content',
      cause: 'STORAGE_ERROR',
      persisted: false,
    })
    expect(response.message).toContain('may not be saved')
    expect(JSON.stringify(response)).not.toContain('/private')
    expect(response.contentRevision).toMatch(/^[a-f0-9]{64}$/)
    // Сбой записи откатывает тело в runtime-кэше: кэш, ревизия и диск совпадают.
    expect(notes().notes.getNoteById(note.id)).toMatchObject({
      name: 'Final',
      content: 'old',
    })
    resetCaches()
    expect(await revision('note', note.id)).toBe(response.contentRevision)
    expect(notes().notes.getNoteById(note.id)).toMatchObject({
      name: 'Final',
      content: 'old',
    })
  })

  it('keeps the revision when a content-only write fails', async () => {
    const note = await call('create_note', { name: 'Draft', content: 'old' })
    const writeFile = fs.writeFileSync
    vi.spyOn(fs, 'writeFileSync').mockImplementation((...args) => {
      if (String(args[1]).includes('NEW BODY')) {
        throw new Error('EACCES: /private/path')
      }
      return writeFile(...args)
    })
    const response = await failed('update_note', {
      id: note.id,
      expectedRevision: note.contentRevision,
      patch: { content: 'NEW BODY' },
    })
    vi.restoreAllMocks()
    // Откат runtime-кэша: ничего не изменилось, поэтому это не PARTIAL_UPDATE.
    expect(response).toMatchObject({ code: 'STORAGE_ERROR' })
    expect(JSON.stringify(response)).not.toContain('/private')
    expect(await revision('note', note.id)).toBe(note.contentRevision)

    await call('update_note', {
      id: note.id,
      expectedRevision: note.contentRevision,
      patch: { content: 'NEW BODY' },
    })
    resetCaches()
    expect(notes().notes.getNoteById(note.id)?.content).toBe('NEW BODY')
  })

  it('reports created tags when the tags step fails midway', async () => {
    const note = await call('create_note', { name: 'Draft', content: 'body' })
    const writeFile = fs.writeFileSync
    // Привязка тега пишет непустой список tags во frontmatter заметки.
    vi.spyOn(fs, 'writeFileSync').mockImplementation((...args) => {
      if (String(args[1]).includes('tags:\n  -')) {
        throw new Error('EACCES: /private/path')
      }
      return writeFile(...args)
    })
    const response = await failed('update_note', {
      id: note.id,
      expectedRevision: note.contentRevision,
      patch: { name: 'Final', tags: ['Fresh'] },
    })
    vi.restoreAllMocks()
    expect(response).toMatchObject({
      code: 'PARTIAL_UPDATE',
      applied: ['metadata'],
      failed: 'tags',
      createdTags: ['Fresh'],
    })
    expect(response).not.toHaveProperty('persisted')
    expect(
      notes()
        .tags.getTags()
        .map(tag => tag.name),
    ).toEqual(['Fresh'])
  })

  it('includes created tags in a partial creation', async () => {
    const writeFile = fs.writeFileSync
    vi.spyOn(fs, 'writeFileSync').mockImplementation((...args) => {
      if (String(args[1]).includes('tags:\n  -')) {
        throw new Error('EACCES: /private/path')
      }
      return writeFile(...args)
    })
    const response = await failed('create_note', {
      name: 'Tagged',
      content: 'body',
      tags: ['Fresh'],
    })
    vi.restoreAllMocks()
    expect(response).toMatchObject({
      code: 'PARTIAL_CREATE',
      type: 'note',
      createdTags: ['Fresh'],
    })
  })

  it('keeps the attached tag when tags differ only by case', async () => {
    const upper = notes().tags.createTag('TS')
    const lower = notes().tags.createTag('ts')
    for (const attached of [
      { id: upper.id, name: 'TS' },
      { id: lower.id, name: 'ts' },
    ]) {
      const note = await call('create_note', {
        name: `N${attached.id}`,
        content: '',
      })
      notes().notes.addTagToNote(note.id, attached.id)
      const current = await revision('note', note.id)
      const updated = await call('update_note', {
        id: note.id,
        expectedRevision: current,
        patch: { tags: ['ts'] },
      })
      expect(updated.tags).toEqual([{ id: attached.id, name: attached.name }])
      expect(updated.createdTags).toEqual([])
      expect(updated.contentRevision).toBe(current)
    }
    const untagged = await call('create_note', { name: 'Plain', content: '' })
    const exact = await call('update_note', {
      id: untagged.id,
      expectedRevision: untagged.contentRevision,
      patch: { tags: ['TS'] },
    })
    expect(exact.tags).toEqual([{ id: upper.id, name: 'TS' }])
  })

  it('reports a failed readback after all steps were saved', async () => {
    const note = await call('create_note', { name: 'Draft', content: 'old' })
    let reads = 0
    wrapNotes = provider => ({
      ...provider,
      notes: {
        ...provider.notes,
        getNoteById: (id: number) => {
          reads += 1
          // Первое чтение сверяет ревизию, второе перечитывает после записи.
          if (reads === 2)
            throw new Error('EIO: /private/path')
          return provider.notes.getNoteById(id)
        },
      },
    })
    const response = await failed('update_note', {
      id: note.id,
      expectedRevision: note.contentRevision,
      patch: { name: 'Final', content: 'new', tags: ['Fresh'] },
    })
    wrapNotes = provider => provider
    expect(response).toMatchObject({
      code: 'PARTIAL_UPDATE',
      applied: ['metadata', 'content', 'tags'],
      failed: 'readback',
      createdTags: ['Fresh'],
    })
    expect(response).not.toHaveProperty('persisted')
    expect(JSON.stringify(response)).not.toContain('/private')
    resetCaches()
    const saved = notes().notes.getNoteById(note.id)
    expect(saved).toMatchObject({ name: 'Final', content: 'new' })
    expect(saved?.tags.map(tag => tag.name)).toEqual(['Fresh'])
  })

  it('refuses edits while the preference is off', async () => {
    const note = await call('create_note', { name: 'Locked', content: 'a' })
    allowEdits = false
    expect(
      await failed('update_note', {
        id: note.id,
        expectedRevision: note.contentRevision,
        patch: { content: 'b' },
      }),
    ).toMatchObject({ code: 'EDITING_DISABLED' })
    expect(
      await failed('trash_item', {
        type: 'note',
        id: note.id,
        expectedRevision: note.contentRevision,
      }),
    ).toMatchObject({ code: 'EDITING_DISABLED' })
    expect(notes().notes.getNoteById(note.id)).toMatchObject({
      content: 'a',
      isDeleted: 0,
    })
  })
})

describe('updating snippets', () => {
  it('edits the only fragment and requires contentId for several', async () => {
    const snippet = await call('create_snippet', {
      name: 'Code',
      content: 'a',
    })
    const updated = await call('update_snippet', {
      id: snippet.id,
      expectedRevision: snippet.contentRevision,
      patch: { fragment: { content: 'b', language: 'typescript' } },
    })
    expect(code().snippets.getSnippetById(snippet.id)?.contents).toMatchObject([
      { value: 'b', language: 'typescript' },
    ])

    code().snippets.createSnippetContent(snippet.id, {
      label: 'Second',
      language: 'plain_text',
      value: 'c',
    })
    const current = await revision('snippet', snippet.id)
    expect(current).not.toBe(updated.contentRevision)
    expect(
      await failed('update_snippet', {
        id: snippet.id,
        expectedRevision: current,
        patch: { fragment: { content: 'x' } },
      }),
    ).toMatchObject({ code: 'FRAGMENT_AMBIGUOUS' })
    expect(
      await failed('update_snippet', {
        id: snippet.id,
        expectedRevision: current,
        patch: { fragment: { contentId: 99999, content: 'x' } },
      }),
    ).toMatchObject({ code: 'NOT_FOUND' })
    expect(await revision('snippet', snippet.id)).toBe(current)

    const second = code().snippets.getSnippetById(snippet.id)!.contents[1]
    await call('update_snippet', {
      id: snippet.id,
      expectedRevision: current,
      patch: { fragment: { contentId: second.id, label: 'Renamed' } },
    })
    expect(
      code()
        .snippets
        .getSnippetById(snippet.id)
        ?.contents
        .map(c => c.label),
    ).toEqual(['Code', 'Renamed'])
  })

  it('rejects a fragment patch for a snippet without fragments', async () => {
    const { id } = code().snippets.createSnippet({
      name: 'Empty',
      folderId: null,
    })
    const current = await revision('snippet', id)
    const before = vaultFiles()
    expect(
      await failed('update_snippet', {
        id,
        expectedRevision: current,
        patch: { fragment: { content: 'x' } },
      }),
    ).toMatchObject({
      code: 'NOT_FOUND',
      message: 'The snippet has no fragments to edit.',
    })
    expect(vaultFiles()).toEqual(before)
    expect(await revision('snippet', id)).toBe(current)
  })

  it('replaces the whole tag set', async () => {
    const snippet = await call('create_snippet', {
      name: 'Tagged',
      content: '',
      tags: ['a', 'b'],
    })
    const updated = await call('update_snippet', {
      id: snippet.id,
      expectedRevision: snippet.contentRevision,
      patch: { tags: ['B', 'c'] },
    })
    expect(updated.tags.map((tag: { name: string }) => tag.name)).toEqual([
      'b',
      'c',
    ])
    expect(updated.createdTags).toEqual(['c'])
    expect(
      code()
        .snippets
        .getSnippetById(snippet.id)
        ?.tags
        .map(tag => tag.name),
    ).toEqual(expect.arrayContaining(['b', 'c']))
    expect(code().snippets.getSnippetById(snippet.id)?.tags).toHaveLength(2)
  })
})

describe('trash', () => {
  it('moves notes, snippets and HTTP requests to trash with CAS', async () => {
    const note = await call('create_note', { name: 'N', content: '' })
    const snippet = await call('create_snippet', { name: 'S', content: '' })
    const request = await call('create_http_request', {
      name: 'R',
      url: 'https://example.com',
    })
    const requestRevision = await revision('http_request', request.id)

    for (const [type, id, current] of [
      ['note', note.id, note.contentRevision],
      ['snippet', snippet.id, snippet.contentRevision],
      ['http_request', request.id, requestRevision],
    ] as const) {
      expect(
        await failed('trash_item', { type, id, expectedRevision: 'stale' }),
      ).toMatchObject({ code: 'CONFLICT' })
      expect(
        await call('trash_item', { type, id, expectedRevision: current }),
      ).toEqual({ type, id, trashed: true })
      expect(await failed('get_item', { type, id })).toMatchObject({
        code: 'NOT_FOUND',
      })
    }
    expect(notes().notes.getNoteById(note.id)?.isDeleted).toBe(1)
    expect(code().snippets.getSnippetById(snippet.id)?.isDeleted).toBe(1)

    expect(
      await failed('trash_item', {
        type: 'note',
        id: note.id,
        expectedRevision: note.contentRevision,
      }),
    ).toMatchObject({ code: 'NOT_FOUND' })
  })

  it('clears the folder of trashed notes and snippets', async () => {
    const noteFolder = notes().folders.createFolder({
      name: 'Docs',
      parentId: null,
    })
    const codeFolder = code().folders.createFolder({
      name: 'Lib',
      parentId: null,
    })
    const note = await call('create_note', {
      name: 'N',
      content: '',
      folderId: noteFolder.id,
    })
    const snippet = await call('create_snippet', {
      name: 'S',
      content: '',
      folderId: codeFolder.id,
    })
    await call('trash_item', {
      type: 'note',
      id: note.id,
      expectedRevision: note.contentRevision,
    })
    await call('trash_item', {
      type: 'snippet',
      id: snippet.id,
      expectedRevision: snippet.contentRevision,
    })
    resetCaches()
    expect(notes().notes.getNoteById(note.id)).toMatchObject({
      isDeleted: 1,
      folder: null,
    })
    expect(code().snippets.getSnippetById(snippet.id)).toMatchObject({
      isDeleted: 1,
      folder: null,
    })
  })

  it('does not trash WebSocket requests', async () => {
    const socket = createHttpRequestsStorage().createRequest({
      name: 'Socket',
      protocol: 'websocket',
    })
    expect(
      await failed('trash_item', {
        type: 'http_request',
        id: socket.id,
        expectedRevision: 'any',
      }),
    ).toMatchObject({ code: 'NOT_FOUND' })
    expect(
      createHttpRequestsStorage().getRequestById(socket.id)?.isDeleted,
    ).toBe(0)
  })
})

describe('note links', () => {
  it('resolves outgoing links and finds incoming notes', async () => {
    const folder = notes().folders.createFolder({
      name: 'Docs',
      parentId: null,
    })
    const guide = await call('create_note', {
      name: 'Guide',
      content: '',
      folderId: folder.id,
    })
    const target = await call('create_note', {
      name: 'Target',
      content: '[[Target]]',
    })
    const snippet = await call('create_snippet', { name: 'Snip', content: '' })
    const source = await call('create_note', {
      name: 'Source',
      content: `[[Target]] [[note:${guide.id}|G]] [[Docs/Guide]] [[Snip]] [[Nope]] [[masscode:planned:note|Later]] [[Target]]`,
    })
    const other = await call('create_note', {
      name: 'Other',
      content: `[[note:${target.id}|t]]`,
    })
    await call('create_note', { name: 'Unrelated', content: 'nothing' })
    const trashed = await call('create_note', {
      name: 'Trashed',
      content: '[[Target]]',
    })
    notes().notes.updateNote(trashed.id, { isDeleted: 1 })

    const links = await call('get_note_links', { id: source.id })
    expect(links.outgoing).toEqual([
      expect.objectContaining({
        type: 'note',
        id: target.id,
        raw: '[[Target]]',
        status: 'resolved',
      }),
      expect.objectContaining({
        type: 'note',
        id: guide.id,
        status: 'resolved',
      }),
      expect.objectContaining({
        type: 'note',
        id: guide.id,
        raw: '[[Docs/Guide]]',
        status: 'resolved',
      }),
      expect.objectContaining({
        type: 'snippet',
        id: snippet.id,
        status: 'resolved',
      }),
      expect.objectContaining({ type: null, id: null, status: 'missing' }),
      expect.objectContaining({ type: 'note', id: null, status: 'planned' }),
    ])

    const incoming = await call('get_note_links', { id: target.id })
    expect(
      incoming.incoming.map((item: { id: number }) => item.id).sort(),
    ).toEqual([source.id, other.id].sort())
    expect(incoming.skippedPendingNotes).toBe(0)
  })

  it('resolves an ambiguous title by the source note folder', async () => {
    const first = notes().folders.createFolder({ name: 'A', parentId: null })
    const second = notes().folders.createFolder({ name: 'B', parentId: null })
    // Проверяем обе папки, чтобы тест не проходил за счёт fallback на первого кандидата.
    for (const folder of [first, second]) {
      const nearby = await call('create_note', {
        name: 'Dup',
        content: '',
        folderId: folder.id,
      })
      const source = await call('create_note', {
        name: `Source ${folder.id}`,
        content: '[[Dup]]',
        folderId: folder.id,
      })
      expect(
        (await call('get_note_links', { id: source.id })).outgoing,
      ).toEqual([
        expect.objectContaining({
          type: 'note',
          id: nearby.id,
          status: 'resolved',
        }),
      ])
    }
  })

  it('resolves HTTP request links and counts pending notes', async () => {
    const request = await call('create_http_request', {
      name: 'Ping',
      url: 'https://example.com',
    })
    const source = await call('create_note', {
      name: 'Source',
      content: `[[http-request:${request.id}|P]] [[Ping]]`,
    })
    const pending = await call('create_note', {
      name: 'Pending',
      content: `[[note:${source.id}]]`,
    })
    // Выгруженную облачным провайдером заметку имитируем флагом в runtime-кэше.
    getNotesRuntimeCache(getNotesPaths(vaultPath)).notes.find(
      note => note.id === pending.id,
    )!.pendingCloudDownload = true

    const links = await call('get_note_links', { id: source.id })
    expect(links.outgoing).toEqual([
      expect.objectContaining({
        type: 'http_request',
        id: request.id,
        status: 'resolved',
      }),
      expect.objectContaining({
        type: 'http_request',
        id: request.id,
        raw: '[[Ping]]',
        status: 'resolved',
      }),
    ])
    expect(links.incoming).toEqual([])
    expect(links.skippedPendingNotes).toBe(1)
  })
})
