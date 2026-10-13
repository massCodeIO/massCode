import type { createStorageMock, MockVault } from './storageMock'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { searchKeywords } from '../keywordIndex'
import { createMockVault } from './storageMock'

const mocks = vi.hoisted(() => ({
  vault: undefined as unknown as MockVault,
  storage: undefined as unknown as ReturnType<typeof createStorageMock>,
  hash: vi.fn(),
}))
vi.mock('../../../storage', async () => {
  const { createStorageMock } = await import('./storageMock')
  mocks.storage = createStorageMock(() => mocks.vault)
  return mocks.storage.module
})
vi.mock('../text', async (importOriginal) => {
  const original = await importOriginal<typeof import('../text')>()
  mocks.hash.mockImplementation(original.textHash)
  return { ...original, textHash: mocks.hash }
})

async function corpus() {
  const { createCorpus } = await import('../corpus')
  return createCorpus()
}

beforeEach(() => {
  mocks.vault = createMockVault()
  mocks.vault.snippets = [1, 2, 3].map(id => ({
    id,
    name: `Snippet ${id}`,
    contents: [{ label: 'main', language: 'ts', value: `body token${id}` }],
  }))
  mocks.vault.requests = [
    {
      id: 1,
      name: 'Orders',
      method: 'GET',
      url: 'https://api.test/orders?key=secret',
      description: 'Lists orders',
    },
  ]
  vi.clearAllMocks()
})

describe('corpus refresh', () => {
  it('hydrates a few records one by one and indexes their bodies', async () => {
    const target = await corpus()
    expect(await target.refresh()).toEqual({
      added: ['snippet:1', 'snippet:2', 'snippet:3', 'http_request:1'],
      changed: [],
      removed: [],
    })
    expect(mocks.storage.snippets.getSnippetById).toHaveBeenCalledTimes(3)
    expect(mocks.storage.snippets.getSnippetsAsync).not.toHaveBeenCalled()
    expect([...searchKeywords(target.keyword, 'token2').keys()]).toEqual([
      'snippet:2',
    ])
    expect([...searchKeywords(target.keyword, 'secret').keys()]).toEqual([])
    expect(target.entries.get('http_request:1')?.record).toMatchObject({
      description: 'Lists orders',
    })
  })

  it('hydrates many records through one withContent list', async () => {
    mocks.vault.notes = Array.from({ length: 60 }, (_, index) => ({
      id: index + 1,
      name: `Note ${index}`,
      content: `deep text ${index}`,
    }))
    const target = await corpus()
    await target.refresh()
    expect(mocks.storage.notes.getNotesAsync).toHaveBeenCalledWith({
      isDeleted: 0,
      withContent: true,
    })
    expect(mocks.storage.notes.getNoteById).not.toHaveBeenCalled()
    expect(target.entries.get('note:60')?.record).toMatchObject({
      content: 'deep text 59',
    })
  })

  it('does not hydrate or hash anything when the vault did not change', async () => {
    const target = await corpus()
    await target.refresh()
    vi.clearAllMocks()
    expect(await target.refresh()).toEqual({
      added: [],
      changed: [],
      removed: [],
    })
    expect(mocks.storage.snippets.getSnippetById).not.toHaveBeenCalled()
    expect(mocks.storage.requests.getRequests).not.toHaveBeenCalled()
    expect(mocks.hash).not.toHaveBeenCalled()
  })

  it('reports changed content, keeps a signature-only change silent and removes deleted records', async () => {
    const target = await corpus()
    await target.refresh()
    const before = target.entries.get('snippet:2')!.h
    mocks.vault.snippets[0] = {
      ...mocks.vault.snippets[0],
      sig: 'edited',
      contents: [{ label: 'main', language: 'ts', value: 'fresh words' }],
    }
    mocks.vault.snippets[1] = { ...mocks.vault.snippets[1], sig: 'touched' }
    mocks.vault.snippets[2] = { ...mocks.vault.snippets[2], isDeleted: 1 }
    vi.clearAllMocks()
    expect(await target.refresh()).toEqual({
      added: [],
      changed: ['snippet:1'],
      removed: ['snippet:3'],
    })
    expect(mocks.storage.snippets.getSnippetById).toHaveBeenCalledTimes(2)
    expect(target.entries.get('snippet:2')).toMatchObject({
      sig: 'touched',
      h: before,
    })
    expect([...searchKeywords(target.keyword, 'fresh').keys()]).toEqual([
      'snippet:1',
    ])
    expect(searchKeywords(target.keyword, 'token1').size).toBe(0)
    expect(target.entries.has('snippet:3')).toBe(false)
  })

  it('keeps many records created in this session out of the full path until they change', async () => {
    // Сигнатура записи без метаданных state — её updatedAt.
    mocks.vault.notes = Array.from({ length: 60 }, (_, index) => ({
      id: index + 1,
      name: `New ${index}`,
      content: `draft ${index}`,
      sig: 'u:1',
    }))
    const target = await corpus()
    await target.refresh()
    vi.clearAllMocks()
    expect(await target.refresh()).toEqual({
      added: [],
      changed: [],
      removed: [],
    })
    expect(mocks.storage.notes.getNotesAsync).not.toHaveBeenCalled()
    expect(mocks.storage.notes.getNoteById).not.toHaveBeenCalled()
    mocks.vault.notes[0] = {
      ...mocks.vault.notes[0],
      sig: 'u:2',
      content: 'edited draft',
    }
    expect((await target.refresh()).changed).toEqual(['note:1'])
    expect(mocks.storage.notes.getNoteById).toHaveBeenCalledTimes(1)
    expect(mocks.storage.notes.getNotesAsync).not.toHaveBeenCalled()
  })

  it('rebuilds the prefix lookup lazily after a bulk update', async () => {
    const target = await corpus()
    await target.refresh()
    expect(searchKeywords(target.keyword, 'tok').size).toBe(3)
    expect(target.keyword.sortedWords).toBeDefined()
    mocks.vault.notes = Array.from({ length: 60 }, (_, index) => ({
      id: index + 1,
      name: `Note ${index}`,
      content: `tokenizer ${index}`,
    }))
    await target.refresh()
    expect(target.keyword.sortedWords).toBeUndefined()
    expect(searchKeywords(target.keyword, 'tok').size).toBe(63)
  })

  it('treats a snippet whose body could not be read as pending and retries it', async () => {
    mocks.vault.requests = []
    mocks.vault.snippets = [
      {
        id: 1,
        name: 'Evicted',
        contents: [{ label: 'a', language: 'ts', value: 'text' }],
      },
    ]
    const unread = {
      ...mocks.vault.snippets[0],
      contents: [{ id: 0, label: 'a', language: 'ts', value: null }],
      description: null,
      isDeleted: 0,
    }
    const target = await corpus()
    mocks.storage.snippets.getSnippetById.mockReturnValueOnce(unread as never)
    await target.refresh()
    expect(target.entries.get('snippet:1')).toMatchObject({ pending: true })
    expect(mocks.hash).not.toHaveBeenCalled()
    expect((await target.refresh()).changed).toEqual(['snippet:1'])
    expect(target.entries.get('snippet:1')).toMatchObject({ pending: false })
  })

  it('rechecks unread bodies one by one instead of the full path', async () => {
    mocks.vault.requests = []
    mocks.vault.notes = Array.from({ length: 60 }, (_, index) => ({
      id: index + 1,
      name: `Note ${index}`,
      content: `text ${index}`,
    }))
    const target = await corpus()
    // Полный путь не дочитал 55 тел: storage помечает их ожидающими облака только в ответе.
    mocks.storage.notes.getNotesAsync.mockImplementationOnce(async () =>
      mocks.vault.notes.map(note => ({
        ...note,
        isDeleted: 0,
        content: note.id > 5 ? '' : note.content,
        pendingCloudDownload: note.id > 5,
      })),
    )
    await target.refresh()
    expect(
      [...target.entries.values()].filter(entry => entry.pending),
    ).toHaveLength(55)
    vi.clearAllMocks()
    await target.refresh()
    expect(mocks.storage.notes.getNotesAsync).not.toHaveBeenCalled()
    expect(mocks.storage.notes.getNoteById).toHaveBeenCalledTimes(55)
    expect(
      [...target.entries.values()].filter(entry => entry.pending),
    ).toHaveLength(0)
  })

  it('finds a record by the new name of its folder without re-embedding it', async () => {
    mocks.vault.requests = []
    mocks.vault.snippets = [
      {
        id: 1,
        name: 'Pool',
        folder: 'Background Jobs',
        contents: [{ label: 'a', language: 'ts', value: 'run tasks' }],
      },
    ]
    const target = await corpus()
    await target.refresh()
    expect(searchKeywords(target.keyword, 'background').has('snippet:1')).toBe(
      true,
    )
    // Переименование папки меняет сигнатуру через её имя, а не updatedAt записи.
    mocks.vault.snippets[0] = {
      ...mocks.vault.snippets[0],
      folder: 'Workers',
      sig: 'sig-1|Workers',
    }
    expect(await target.refresh()).toEqual({
      added: [],
      changed: [],
      removed: [],
    })
    expect(searchKeywords(target.keyword, 'workers').has('snippet:1')).toBe(
      true,
    )
    expect(searchKeywords(target.keyword, 'background').has('snippet:1')).toBe(
      false,
    )
  })

  it('hashes only the part of an HTTP url that is searched', async () => {
    const { recordHash } = await import('../corpus')
    const request = {
      type: 'http_request' as const,
      id: 1,
      name: 'Orders',
      method: 'GET',
      description: '',
    }
    expect(
      recordHash({ ...request, url: 'https://a.test/orders?token=1' }),
    ).toBe(recordHash({ ...request, url: 'https://b.test/orders?token=2' }))
    expect(recordHash({ ...request, url: 'https://a.test/orders' })).not.toBe(
      recordHash({ ...request, url: 'https://a.test/invoices' }),
    )
  })

  it('keeps records waiting for the cloud searchable by name without reading or hashing them', async () => {
    mocks.vault.snippets = [
      {
        id: 7,
        name: 'Cloud placeholder',
        pendingCloudDownload: true,
        contents: [{ label: 'a', language: 'ts', value: 'hidden' }],
      },
    ]
    mocks.vault.requests = []
    const target = await corpus()
    await target.refresh()
    expect(mocks.storage.snippets.getSnippetById).not.toHaveBeenCalled()
    expect(mocks.hash).not.toHaveBeenCalled()
    expect(target.entries.get('snippet:7')).toMatchObject({
      pending: true,
      name: 'Cloud placeholder',
    })
    expect(target.entries.get('snippet:7')?.h).toBeUndefined()
    expect([...searchKeywords(target.keyword, 'placeholder').keys()]).toEqual([
      'snippet:7',
    ])
  })

  it('runs one refresh at a time and repeats a refresh requested meanwhile', async () => {
    const target = await corpus()
    const first = target.refresh()
    mocks.vault.snippets.push({ id: 4, name: 'Late', contents: [] })
    const second = target.refresh()
    await first
    expect((await second).added).toEqual(['snippet:4'])
  })
})
