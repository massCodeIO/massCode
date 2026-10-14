import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetHttpRuntimeCache } from '../../storage/providers/markdown/http/runtime/sync'
import { createHttpFoldersStorage } from '../../storage/providers/markdown/http/storages/folders'
import { createHttpRequestsStorage } from '../../storage/providers/markdown/http/storages/requests'
import { getNotesPaths } from '../../storage/providers/markdown/notes/runtime/constants'
import { resetNotesRuntimeCache } from '../../storage/providers/markdown/notes/runtime/sync'
import { createNotesStorageProvider } from '../../storage/providers/markdown/notes/storages'
import { getPaths } from '../../storage/providers/markdown/runtime/paths'
import { resetRuntimeCache } from '../../storage/providers/markdown/runtime/sync'
import { createMarkdownStorageProvider } from '../../storage/providers/markdown/storages'
import { createMcpRoute } from './route'

type NotesProvider = ReturnType<typeof createNotesStorageProvider>

let vaultPath = ''
let allowEdits = true
// Мок useNotesStorage каждый раз создаёт новый провайдер, поэтому spy на
// возвращённом объекте не сработает: подменяем методы через эту обёртку.
let wrapNotes = (provider: NotesProvider) => provider
const send = vi.hoisted(() => vi.fn())
vi.mock('electron', () => ({
  app: { getPath: () => os.tmpdir(), isReady: () => false },
  BrowserWindow: {
    getAllWindows: () => [{ webContents: { send } }],
    getFocusedWindow: () => null,
  },
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
const requests = () => createHttpRequestsStorage()

function resetCaches() {
  resetRuntimeCache()
  resetNotesRuntimeCache()
  resetHttpRuntimeCache()
}

beforeEach(() => {
  allowEdits = true
  wrapNotes = provider => provider
  send.mockClear()
  vaultPath = fs.mkdtempSync(path.join(os.tmpdir(), 'masscode-mcp-organize-'))
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
    text: payload.result.content[0].text as string,
  }
}

async function call(name: string, args: Record<string, unknown>) {
  const response = await toolCall(name, args)
  expect(response.isError, response.text).toBe(false)
  return JSON.parse(response.text)
}

async function failed(name: string, args: Record<string, unknown>) {
  const response = await toolCall(name, args)
  expect(response.isError, response.text).toBe(true)
  return JSON.parse(response.text)
}

const noteFolders = () => notes().folders.getFolders()
function syncedCount() {
  return send.mock.calls.filter(
    ([channel]) => channel === 'system:storage-synced',
  ).length
}

describe('create_folder', () => {
  it('creates root and nested folders without the edit preference', async () => {
    allowEdits = false
    const root = await call('create_folder', { space: 'notes', name: 'Work' })
    expect(root).toEqual({
      space: 'notes',
      id: expect.any(Number),
      name: 'Work',
      parentId: null,
    })
    const nested = await call('create_folder', {
      space: 'code',
      name: 'Lib',
      parentId: null,
    })
    const child = await call('create_folder', {
      space: 'code',
      name: 'Utils',
      parentId: nested.id,
    })
    expect(child).toMatchObject({
      space: 'code',
      name: 'Utils',
      parentId: nested.id,
    })
    expect(
      code()
        .folders.getFolders()
        .map(folder => folder.name)
        .sort(),
    ).toEqual(['Lib', 'Utils'])
    expect(noteFolders().map(folder => folder.name)).toEqual(['Work'])
  })

  it('reports a case-insensitive name conflict with the parent name', async () => {
    const parent = await call('create_folder', { space: 'notes', name: 'Ops' })
    await call('create_folder', {
      space: 'notes',
      name: 'Runbooks',
      parentId: parent.id,
    })
    expect(
      await failed('create_folder', {
        space: 'notes',
        name: 'runbooks',
        parentId: parent.id,
      }),
    ).toMatchObject({
      code: 'NAME_CONFLICT',
      parentId: parent.id,
      parentName: 'Ops',
    })
    expect(
      await failed('create_folder', { space: 'notes', name: 'OPS' }),
    ).toMatchObject({
      code: 'NAME_CONFLICT',
      parentId: null,
      parentName: null,
    })
  })

  it('rejects reserved, invalid names and a missing parent', async () => {
    expect(
      await failed('create_folder', { space: 'notes', name: 'Trash' }),
    ).toMatchObject({
      code: 'RESERVED_NAME',
      message: expect.stringContaining('reserved'),
    })
    expect(
      await failed('create_folder', { space: 'code', name: 'inbox' }),
    ).toMatchObject({ code: 'RESERVED_NAME' })
    expect(
      await failed('create_folder', { space: 'code', name: 'a:b' }),
    ).toMatchObject({ code: 'INVALID_NAME', reason: 'invalidChars' })
    expect(
      await failed('create_folder', { space: 'notes', name: '.masscode' }),
    ).toMatchObject({ code: 'INVALID_NAME', reason: 'leadingDot' })
    expect(
      await failed('create_folder', {
        space: 'notes',
        name: 'X',
        parentId: 999,
      }),
    ).toMatchObject({
      code: 'NOT_FOUND',
      message: expect.stringContaining('list_structure'),
    })
    expect(noteFolders()).toHaveLength(0)
    expect(code().folders.getFolders()).toHaveLength(0)
  })
})

describe('update_folder', () => {
  it('renames and moves folders, returning the actual name', async () => {
    const a = notes().folders.createFolder({ name: 'A', parentId: null })
    const b = notes().folders.createFolder({ name: 'B', parentId: null })
    const child = notes().folders.createFolder({
      name: 'Child',
      parentId: a.id,
    })
    notes().folders.createFolder({ name: 'Child', parentId: b.id })

    expect(
      await call('update_folder', { space: 'notes', id: a.id, name: 'Alpha' }),
    ).toEqual({ space: 'notes', id: a.id, name: 'Alpha', parentId: null })

    const moved = await call('update_folder', {
      space: 'notes',
      id: child.id,
      parentId: b.id,
    })
    expect(moved).toMatchObject({ id: child.id, parentId: b.id })
    expect(moved.name).not.toBe('Child')
    expect(noteFolders().find(folder => folder.id === child.id)?.name).toBe(
      moved.name,
    )

    expect(
      await call('update_folder', {
        space: 'notes',
        id: child.id,
        parentId: null,
      }),
    ).toMatchObject({ id: child.id, parentId: null })
  })

  it('reports a rename conflict in the same parent', async () => {
    const parent = code().folders.createFolder({ name: 'Lib', parentId: null })
    code().folders.createFolder({ name: 'One', parentId: parent.id })
    const two = code().folders.createFolder({
      name: 'Two',
      parentId: parent.id,
    })
    expect(
      await failed('update_folder', { space: 'code', id: two.id, name: 'ONE' }),
    ).toMatchObject({
      code: 'NAME_CONFLICT',
      parentId: parent.id,
      parentName: 'Lib',
    })
  })

  it('refuses to move a folder into itself or its subtree', async () => {
    const root = code().folders.createFolder({ name: 'Root', parentId: null })
    const child = code().folders.createFolder({
      name: 'Child',
      parentId: root.id,
    })
    const grandchild = code().folders.createFolder({
      name: 'Grand',
      parentId: child.id,
    })
    for (const parentId of [root.id, child.id, grandchild.id]) {
      expect(
        await failed('update_folder', { space: 'code', id: root.id, parentId }),
      ).toMatchObject({ code: 'INVALID_PARENT' })
    }
    expect(
      await failed('update_folder', {
        space: 'code',
        id: root.id,
        parentId: 999,
      }),
    ).toMatchObject({ code: 'NOT_FOUND' })
    expect(
      await failed('update_folder', { space: 'code', id: 999, name: 'X' }),
    ).toMatchObject({ code: 'NOT_FOUND' })
    expect(
      code()
        .folders
        .getFolders()
        .find(folder => folder.id === root.id)
        ?.parentId,
    ).toBeNull()
  })

  it('requires a field and the edit preference', async () => {
    const folder = notes().folders.createFolder({
      name: 'Keep',
      parentId: null,
    })
    expect(
      (await toolCall('update_folder', { space: 'notes', id: folder.id }))
        .isError,
    ).toBe(true)
    allowEdits = false
    expect(
      await failed('update_folder', {
        space: 'notes',
        id: folder.id,
        name: 'New',
      }),
    ).toMatchObject({ code: 'EDITING_DISABLED' })
    expect(noteFolders()[0].name).toBe('Keep')
  })
})

describe('delete_folder', () => {
  it('deletes an empty folder and refuses a non-empty one', async () => {
    const empty = notes().folders.createFolder({
      name: 'Empty',
      parentId: null,
    })
    expect(
      await call('delete_folder', { space: 'notes', id: empty.id }),
    ).toEqual({ space: 'notes', id: empty.id, deleted: true })
    expect(noteFolders()).toHaveLength(0)

    const parent = code().folders.createFolder({
      name: 'Parent',
      parentId: null,
    })
    code().folders.createFolder({ name: 'Sub', parentId: parent.id })
    code().snippets.createSnippet({ name: 'S', folderId: parent.id })
    expect(
      await failed('delete_folder', { space: 'code', id: parent.id }),
    ).toMatchObject({ code: 'FOLDER_NOT_EMPTY', subfolders: 1, items: 1 })
    expect(code().folders.getFolders()).toHaveLength(2)
  })

  it('is not blocked by items in Trash and keeps them in Trash', async () => {
    const folder = notes().folders.createFolder({
      name: 'Old',
      parentId: null,
    })
    const { id } = notes().notes.createNote({
      name: 'Gone',
      folderId: folder.id,
    })
    // Старые записи в корзине могли сохранить folderId.
    notes().notes.updateNote(id, { isDeleted: 1 })
    expect(
      await call('delete_folder', { space: 'notes', id: folder.id }),
    ).toMatchObject({ deleted: true })
    expect(notes().notes.getNoteById(id)?.isDeleted).toBe(1)
  })

  it('refuses to delete a directory with files massCode does not manage', async () => {
    const folder = notes().folders.createFolder({
      name: 'Mixed',
      parentId: null,
    })
    const foreign = path.join(
      getNotesPaths(vaultPath).notesRoot,
      'Mixed',
      'photo.png',
    )
    fs.writeFileSync(foreign, 'binary')
    expect(
      await failed('delete_folder', { space: 'notes', id: folder.id }),
    ).toMatchObject({
      code: 'FOLDER_NOT_EMPTY',
      subfolders: 0,
      items: 0,
      files: 1,
    })
    expect(fs.existsSync(foreign)).toBe(true)
    expect(noteFolders()).toHaveLength(1)
    expect(syncedCount()).toBe(0)
  })

  it('finds unmanaged files in nested directories of a code folder', async () => {
    const folder = code().folders.createFolder({ name: 'Lib', parentId: null })
    const extra = path.join(getPaths(vaultPath).vaultPath, 'Lib', 'extra')
    fs.ensureDirSync(extra)
    fs.writeFileSync(path.join(extra, 'photo.png'), 'binary')
    const response = await failed('delete_folder', {
      space: 'code',
      id: folder.id,
    })
    expect(response).toMatchObject({
      code: 'FOLDER_NOT_EMPTY',
      subfolders: 0,
      items: 0,
    })
    expect(response.files).toBeGreaterThanOrEqual(1)
    expect(fs.existsSync(path.join(extra, 'photo.png'))).toBe(true)
    expect(code().folders.getFolders()).toHaveLength(1)
  })

  it('ignores folder metadata and system files', async () => {
    const folder = code().folders.createFolder({
      name: 'Plain',
      parentId: null,
    })
    const directory = path.join(getPaths(vaultPath).vaultPath, 'Plain')
    fs.writeFileSync(path.join(directory, '.DS_Store'), '')
    fs.writeFileSync(path.join(directory, 'Thumbs.db'), '')
    expect(fs.readdirSync(directory)).toContain('.meta.yaml')
    expect(
      await call('delete_folder', { space: 'code', id: folder.id }),
    ).toMatchObject({ deleted: true })
    expect(fs.existsSync(directory)).toBe(false)
  })

  it('reports a missing folder and respects the edit preference', async () => {
    expect(
      await failed('delete_folder', { space: 'code', id: 999 }),
    ).toMatchObject({ code: 'NOT_FOUND' })
    const folder = code().folders.createFolder({
      name: 'Keep',
      parentId: null,
    })
    allowEdits = false
    expect(
      await failed('delete_folder', { space: 'code', id: folder.id }),
    ).toMatchObject({ code: 'EDITING_DISABLED' })
    expect(code().folders.getFolders()).toHaveLength(1)
  })
})

describe('move_items', () => {
  it('moves items with per-item results and renames on conflict', async () => {
    const box = code().folders.createFolder({ name: 'Box', parentId: null })
    code().snippets.createSnippet({ name: 'Same', folderId: box.id })
    const same = code().snippets.createSnippet({
      name: 'Same',
      folderId: null,
    })
    const other = code().snippets.createSnippet({
      name: 'Other',
      folderId: null,
    })
    const trashed = code().snippets.createSnippet({
      name: 'T',
      folderId: null,
    })
    code().snippets.updateSnippet(trashed.id, { isDeleted: 1 })

    const moved = await call('move_items', {
      space: 'code',
      ids: [same.id, other.id, other.id, 999, trashed.id],
      folderId: box.id,
    })
    expect(moved.folderId).toBe(box.id)
    expect(moved.results).toEqual([
      { id: same.id, ok: true, name: expect.not.stringMatching(/^Same$/) },
      { id: other.id, ok: true, name: 'Other' },
      { id: 999, ok: false, error: 'NOT_FOUND' },
      { id: trashed.id, ok: false, error: 'NOT_FOUND' },
    ])
    expect(code().snippets.getSnippetById(same.id)?.folder?.id).toBe(box.id)
    expect(code().snippets.getSnippetById(same.id)?.name).toBe(
      moved.results[0].name,
    )
    expect(code().snippets.getSnippetById(trashed.id)?.folder).toBeNull()

    const again = await call('move_items', {
      space: 'code',
      ids: [other.id],
      folderId: box.id,
    })
    expect(again.results).toEqual([{ id: other.id, ok: true, name: 'Other' }])

    const inbox = await call('move_items', {
      space: 'code',
      ids: [other.id],
      folderId: null,
    })
    expect(inbox.results[0]).toMatchObject({ ok: true })
    expect(code().snippets.getSnippetById(other.id)?.folder).toBeNull()
  })

  it('notifies once after writes and never without writes', async () => {
    const box = code().folders.createFolder({ name: 'Box', parentId: null })
    const one = code().snippets.createSnippet({ name: 'One', folderId: null })
    const two = code().snippets.createSnippet({ name: 'Two', folderId: null })
    await call('move_items', {
      space: 'code',
      ids: [one.id, two.id],
      folderId: box.id,
    })
    expect(syncedCount()).toBe(1)

    send.mockClear()
    await call('move_items', {
      space: 'code',
      ids: [one.id, two.id, 999],
      folderId: box.id,
    })
    expect(syncedCount()).toBe(0)
  })

  it('rejects more than 100 ids', async () => {
    const { id } = notes().notes.createNote({ name: 'N', folderId: null })
    const folder = notes().folders.createFolder({ name: 'F', parentId: null })
    const ids = Array.from({ length: 101 }, (_, index) =>
      index === 0 ? id : 1000 + index)
    expect(
      (
        await toolCall('move_items', {
          space: 'notes',
          ids,
          folderId: folder.id,
        })
      ).isError,
    ).toBe(true)
    expect(notes().notes.getNoteById(id)?.folder).toBeNull()
  })

  it('treats a storage error after the move as success', async () => {
    const folder = notes().folders.createFolder({ name: 'F', parentId: null })
    const { id } = notes().notes.createNote({ name: 'N', folderId: null })
    wrapNotes = (provider) => {
      const updateNote = provider.notes.updateNote
      provider.notes.updateNote = (...args) => {
        updateNote(...args)
        throw new Error('STORAGE_ERROR')
      }
      return provider
    }
    expect(
      (
        await call('move_items', {
          space: 'notes',
          ids: [id],
          folderId: folder.id,
        })
      ).results,
    ).toEqual([{ id, ok: true, name: 'N' }])
    expect(syncedCount()).toBe(1)
  })

  it('reports a storage error before the move', async () => {
    const folder = notes().folders.createFolder({ name: 'F', parentId: null })
    const { id } = notes().notes.createNote({ name: 'N', folderId: null })
    wrapNotes = (provider) => {
      provider.notes.updateNote = () => {
        throw new Error('STORAGE_ERROR')
      }
      return provider
    }
    expect(
      (
        await call('move_items', {
          space: 'notes',
          ids: [id],
          folderId: folder.id,
        })
      ).results,
    ).toEqual([{ id, ok: false, error: 'STORAGE_ERROR' }])
    expect(syncedCount()).toBe(0)
  })

  it('rejects a missing target folder without writing', async () => {
    const { id } = notes().notes.createNote({ name: 'N', folderId: null })
    expect(
      await failed('move_items', { space: 'notes', ids: [id], folderId: 999 }),
    ).toMatchObject({ code: 'NOT_FOUND' })
    expect(notes().notes.getNoteById(id)?.folder).toBeNull()
  })

  it('rewrites title links when moving a note', async () => {
    const from = notes().folders.createFolder({ name: 'From', parentId: null })
    const to = notes().folders.createFolder({ name: 'To', parentId: null })
    const target = notes().notes.createNote({
      name: 'Target',
      folderId: from.id,
    })
    const linker = notes().notes.createNote({ name: 'Linker', folderId: null })
    notes().notes.updateNoteContent(linker.id, 'See [[From/Target]]')

    await call('move_items', {
      space: 'notes',
      ids: [target.id],
      folderId: to.id,
    })
    expect(notes().notes.getNoteById(linker.id)?.content).toBe(
      'See [[Target]]',
    )
  })

  it('respects the edit preference', async () => {
    const { id } = notes().notes.createNote({ name: 'N', folderId: null })
    const folder = notes().folders.createFolder({ name: 'F', parentId: null })
    allowEdits = false
    expect(
      await failed('move_items', {
        space: 'notes',
        ids: [id],
        folderId: folder.id,
      }),
    ).toMatchObject({ code: 'EDITING_DISABLED' })
    expect(notes().notes.getNoteById(id)?.folder).toBeNull()
  })
})

describe('restore_item', () => {
  it('restores snippets, notes and HTTP requests to Inbox', async () => {
    const folder = code().folders.createFolder({ name: 'Box', parentId: null })
    const snippet = code().snippets.createSnippet({
      name: 'S',
      folderId: folder.id,
    })
    code().snippets.updateSnippet(snippet.id, { isDeleted: 1 })
    const note = notes().notes.createNote({ name: 'N', folderId: null })
    notes().notes.updateNote(note.id, { isDeleted: 1, folderId: null })
    const request = requests().createRequest({
      name: 'R',
      url: 'https://example.com',
    })
    requests().updateRequest(request.id, { isDeleted: 1, folderId: null })

    for (const [type, id, name] of [
      ['snippet', snippet.id, 'S'],
      ['note', note.id, 'N'],
      ['http_request', request.id, 'R'],
    ] as const) {
      const restored = await call('restore_item', { type, id })
      expect(restored).toEqual({
        type,
        id,
        name,
        folderId: null,
        contentRevision: expect.any(String),
      })
      expect((await call('get_item', { type, id })).contentRevision).toBe(
        restored.contentRevision,
      )
      expect(await failed('restore_item', { type, id })).toMatchObject({
        code: 'NOT_IN_TRASH',
      })
    }
    expect(code().snippets.getSnippetById(snippet.id)?.folder).toBeNull()
  })

  it('reports success when reading back after restoring fails', async () => {
    const { id } = notes().notes.createNote({ name: 'N', folderId: null })
    notes().notes.updateNote(id, { isDeleted: 1 })
    let restored = false
    wrapNotes = (provider) => {
      const { getNoteById, updateNote } = provider.notes
      provider.notes.updateNote = (...args) => {
        const updated = updateNote(...args)
        restored = true
        return updated
      }
      provider.notes.getNoteById = (noteId) => {
        if (restored)
          throw new Error('STORAGE_ERROR')
        return getNoteById(noteId)
      }
      return provider
    }
    expect(await call('restore_item', { type: 'note', id })).toEqual({
      type: 'note',
      id,
      name: 'N',
      folderId: null,
      contentRevision: null,
      message: expect.stringContaining('get_item'),
    })
    expect(syncedCount()).toBe(1)
    wrapNotes = provider => provider
    expect(notes().notes.getNoteById(id)?.isDeleted).toBe(0)
  })

  it('reports missing items, WebSocket requests and the edit preference', async () => {
    expect(
      await failed('restore_item', { type: 'note', id: 999 }),
    ).toMatchObject({ code: 'NOT_FOUND' })
    const socket = requests().createRequest({
      name: 'Socket',
      protocol: 'websocket',
    })
    requests().updateRequest(socket.id, { isDeleted: 1 })
    expect(
      await failed('restore_item', { type: 'http_request', id: socket.id }),
    ).toMatchObject({ code: 'NOT_FOUND' })

    const note = notes().notes.createNote({ name: 'N', folderId: null })
    notes().notes.updateNote(note.id, { isDeleted: 1 })
    allowEdits = false
    expect(
      await failed('restore_item', { type: 'note', id: note.id }),
    ).toMatchObject({ code: 'EDITING_DISABLED' })
    expect(notes().notes.getNoteById(note.id)?.isDeleted).toBe(1)
  })
})

describe('list_items', () => {
  it('filters by folder, Inbox, tag and status with pagination', async () => {
    const folder = notes().folders.createFolder({
      name: 'Docs',
      parentId: null,
    })
    const a = notes().notes.createNote({ name: 'A', folderId: folder.id })
    const b = notes().notes.createNote({ name: 'B', folderId: null })
    const c = notes().notes.createNote({ name: 'C', folderId: null })
    notes().notes.updateNoteContent(b.id, 'secret body')
    const tag = notes().tags.createTag('Work')
    notes().notes.addTagToNote(b.id, tag.id)
    notes().notes.addTagToNote(a.id, tag.id)
    notes().notes.updateNote(c.id, { isDeleted: 1, folderId: null })

    const all = await toolCall('list_items', { space: 'notes' })
    expect(all.text).not.toContain('secret body')
    expect(JSON.parse(all.text)).toMatchObject({
      space: 'notes',
      status: 'active',
      items: [
        { type: 'note', id: a.id },
        { type: 'note', id: b.id },
      ],
      hasMore: false,
      nextOffset: null,
    })

    const ids = async (args: Record<string, unknown>) =>
      (await call('list_items', { space: 'notes', ...args })).items.map(
        (item: { id: number }) => item.id,
      )
    expect(await ids({ folderId: folder.id })).toEqual([a.id])
    expect(await ids({ folderId: 'inbox' })).toEqual([b.id])
    expect(await ids({ tag: 'work' })).toEqual([a.id, b.id])
    expect(await ids({ tag: 'missing' })).toEqual([])
    expect(await ids({ status: 'trash' })).toEqual([c.id])

    const first = await call('list_items', { space: 'notes', limit: 1 })
    expect(first).toMatchObject({ hasMore: true, nextOffset: 1 })
    const second = await call('list_items', {
      space: 'notes',
      limit: 1,
      offset: 1,
    })
    expect(second.items.map((item: { id: number }) => item.id)).toEqual([b.id])
    expect(second).toMatchObject({ hasMore: false, nextOffset: null })
  })

  it('reports an unknown folder', async () => {
    expect(
      await failed('list_items', { space: 'code', folderId: 999 }),
    ).toMatchObject({ code: 'NOT_FOUND' })
  })

  it('lists trashed HTTP requests separately', async () => {
    const active = requests().createRequest({
      name: 'Active',
      url: 'https://example.com',
    })
    const trashed = requests().createRequest({
      name: 'Gone',
      url: 'https://example.com',
    })
    requests().updateRequest(trashed.id, { isDeleted: 1, folderId: null })
    const ids = async (args: Record<string, unknown>) =>
      (await call('list_http_requests', args)).items.map(
        (item: { id: number }) => item.id,
      )
    expect(await ids({})).toEqual([active.id])
    expect(await ids({ status: 'trash' })).toEqual([trashed.id])
    expect(await ids({ status: 'trash', folderId: null })).toEqual([
      trashed.id,
    ])
    expect(await ids({ folderId: null })).toEqual([active.id])
  })

  it('lists snippets of the Code space', async () => {
    const snippet = code().snippets.createSnippet({
      name: 'S',
      folderId: null,
    })
    notes().notes.createNote({ name: 'N', folderId: null })
    expect((await call('list_items', { space: 'code' })).items).toEqual([
      expect.objectContaining({ type: 'snippet', id: snippet.id }),
    ])
  })
})
