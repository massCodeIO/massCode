import type { createStorageMock, MockVault } from './storageMock'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockVault } from './storageMock'

const KEY = {
  vault: '/vault',
  source: 'builtin' as const,
  model: 'embed',
}

// Направление вектора по теме текста: запрос про выкладку близок только к заметке про релиз.
function vectorOf(text: string) {
  if (/release|ship/i.test(text))
    return Float32Array.from([1, 0, 0])
  if (/retry/i.test(text))
    return Float32Array.from([0, 1, 0])
  return Float32Array.from([0, 0, 1])
}

const mocks = vi.hoisted(() => ({
  userData: '',
  key: undefined as typeof KEY | undefined,
  vault: undefined as unknown as MockVault,
  storage: undefined as unknown as ReturnType<typeof createStorageMock>,
  embed: vi.fn(),
  embedQuery: vi.fn(),
}))
vi.mock('electron', () => ({ app: { getPath: () => mocks.userData } }))
vi.mock('../../../store', () => ({
  store: { preferences: { get: () => '/vault' } },
}))
vi.mock('../../settings', () => ({
  getAiSemanticSettings: () => ({ source: 'builtin' }),
}))
vi.mock('../embeddings', async importOriginal => ({
  ...(await importOriginal<typeof import('../embeddings')>()),
  currentSemanticKey: () => mocks.key,
  embedTexts: mocks.embed,
  embedQuery: mocks.embedQuery,
}))
vi.mock('../../../storage', async () => {
  const { createStorageMock } = await import('./storageMock')
  mocks.storage = createStorageMock(() => mocks.vault)
  return mocks.storage.module
})

beforeEach(() => {
  vi.resetModules()
  mocks.userData = fs.mkdtempSync(path.join(os.tmpdir(), 'masscode-semantic-'))
  mocks.key = undefined
  mocks.vault = createMockVault()
  mocks.vault.snippets = [
    {
      id: 1,
      name: 'Staging hosts',
      contents: [
        {
          label: 'hosts.ini',
          language: 'ini',
          value: '[web]\n# Inventory deployment for staging web and db groups',
        },
      ],
    },
    {
      id: 2,
      name: 'Fetch helper',
      contents: [
        {
          label: 'fetch.ts',
          language: 'ts',
          value: 'retry the request with jitter and backoff',
        },
      ],
    },
  ]
  mocks.vault.notes = [
    {
      id: 1,
      name: 'Release checklist',
      content: 'Tag the build, make installers, upload them.',
    },
  ]
  mocks.embed
    .mockReset()
    .mockImplementation(async (_key: unknown, texts: string[]) =>
      texts.map(vectorOf),
    )
  mocks.embedQuery
    .mockReset()
    .mockImplementation(async (_key: unknown, query: string) =>
      vectorOf(query),
    )
})
afterEach(() => {
  fs.rmSync(mocks.userData, { recursive: true, force: true })
})

describe('searchVault', () => {
  it('finds words in bodies with an excerpt and keeps meaning off without a model', async () => {
    const { searchVault } = await import('../searchVault')
    const result = await searchVault({
      query: 'inventory deploy',
      types: ['snippet', 'note', 'http_request'],
      mode: 'full',
    })
    expect(result.meaning).toBe('off')
    expect(mocks.embedQuery).not.toHaveBeenCalled()
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      ref: 'snippet:1',
      type: 'snippet',
      id: 1,
      reason: 'words',
    })
    const { text, ranges } = result.items[0].excerpt!
    expect(ranges.map(([from, to]) => text.slice(from, to))).toEqual([
      'Inventory',
      'deployment',
    ])
    expect(result.strongCount).toBe(1)
  })

  it('reports a warming index, then adds meaning hits in the full phase only', async () => {
    mocks.key = KEY
    const { searchVault } = await import('../searchVault')
    const { syncIndex } = await import('../vectorIndex')
    const warming = await searchVault({
      query: 'how do we ship',
      types: ['snippet', 'note'],
      mode: 'full',
    })
    expect(warming.meaning).toBe('warming')
    expect(warming.items).toEqual([])
    await syncIndex()
    const words = await searchVault({
      query: 'how do we ship',
      types: ['snippet', 'note'],
      mode: 'words',
    })
    expect(words).toMatchObject({ meaning: 'ready', items: [] })
    expect(mocks.embedQuery).not.toHaveBeenCalled()
    const full = await searchVault({
      query: 'how do we ship',
      types: ['snippet', 'note'],
      mode: 'full',
    })
    expect(full.meaning).toBe('ready')
    expect(full.items.map(item => [item.ref, item.reason])).toEqual([
      ['note:1', 'meaning'],
    ])
    expect(full.items[0].excerpt).toEqual({
      text: 'Tag the build, make installers, upload them.',
      ranges: [],
    })
  })

  it('filters by type and by an allow list before ranking', async () => {
    mocks.vault.notes.push({
      id: 2,
      name: 'Retry notes',
      content: 'retry policies',
    })
    const { searchVault } = await import('../searchVault')
    const notesOnly = await searchVault({
      query: 'retry',
      types: ['note'],
      mode: 'words',
    })
    expect(notesOnly.items.map(item => item.ref)).toEqual(['note:2'])
    const allowed = await searchVault({
      query: 'retry',
      types: ['snippet', 'note'],
      mode: 'words',
      allow: ref => ref === 'snippet:2',
    })
    expect(allowed.items.map(item => item.ref)).toEqual(['snippet:2'])
  })

  it('keeps word results when the query embedding fails', async () => {
    mocks.key = KEY
    const { searchVault } = await import('../searchVault')
    const { syncIndex } = await import('../vectorIndex')
    await syncIndex()
    mocks.embedQuery.mockRejectedValueOnce(new Error('worker crashed'))
    const result = await searchVault({
      query: 'inventory',
      types: ['snippet', 'note'],
      mode: 'full',
    })
    expect(result.meaning).toBe('ready')
    expect(result.items.map(item => item.ref)).toEqual(['snippet:1'])
  })

  it('searches the last corpus when a refresh throws', async () => {
    const { searchVault } = await import('../searchVault')
    await searchVault({
      query: 'inventory',
      types: ['snippet'],
      mode: 'words',
    })
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.storage.snippets.getSnippetSignatures.mockImplementationOnce(() => {
      throw new Error('vault unavailable')
    })
    const result = await searchVault({
      query: 'inventory',
      types: ['snippet'],
      mode: 'words',
    })
    expect(result.items.map(item => item.ref)).toEqual(['snippet:1'])
    expect(errors).toHaveBeenCalled()
    errors.mockRestore()
  })

  it('does not prepare vectors or embed the query in the words phase', async () => {
    mocks.key = KEY
    const { searchVault } = await import('../searchVault')
    const vectorIndex = await import('../vectorIndex')
    await vectorIndex.syncIndex()
    const result = await searchVault({
      query: 'how do we ship',
      types: ['note'],
      mode: 'words',
    })
    expect(result.meaning).toBe('ready')
    expect(mocks.embedQuery).not.toHaveBeenCalled()
  })

  it('does not embed one- and two-letter queries in the full phase', async () => {
    mocks.key = KEY
    const { searchVault } = await import('../searchVault')
    const { syncIndex } = await import('../vectorIndex')
    await syncIndex()
    await searchVault({ query: 'sh', types: ['note'], mode: 'full' })
    expect(mocks.embedQuery).not.toHaveBeenCalled()
    await searchVault({ query: 'shi', types: ['note'], mode: 'full' })
    expect(mocks.embedQuery).toHaveBeenCalledTimes(1)
  })

  it('shows the start of the note text when its name vector matched', async () => {
    mocks.key = KEY
    // Совпадает только вектор чанка-названия: в нём текст повторяет название.
    mocks.embed.mockImplementation(async (_key: unknown, texts: string[]) =>
      texts.map(text =>
        text === 'title: Release checklist | text: Release checklist'
          ? Float32Array.from([1, 0, 0])
          : Float32Array.from([0, 0, 1]),
      ),
    )
    const { searchVault } = await import('../searchVault')
    const { syncIndex } = await import('../vectorIndex')
    await syncIndex()
    const result = await searchVault({
      query: 'how do we ship',
      types: ['note'],
      mode: 'full',
    })
    expect(result.items[0]).toMatchObject({
      ref: 'note:1',
      reason: 'meaning',
      excerpt: {
        text: 'Tag the build, make installers, upload them.',
        ranges: [],
      },
    })
  })

  it('picks up an edit made in the app on the next keystroke', async () => {
    const { searchVault } = await import('../searchVault')
    expect(
      (
        await searchVault({
          query: 'kubernetes',
          types: ['note'],
          mode: 'words',
        })
      ).items,
    ).toEqual([])
    mocks.vault.notes[0] = {
      ...mocks.vault.notes[0],
      sig: 'edited',
      content: 'Deploy to kubernetes',
    }
    expect(
      (
        await searchVault({
          query: 'kubernetes',
          types: ['note'],
          mode: 'words',
        })
      ).items.map(item => item.ref),
    ).toEqual(['note:1'])
  })
})
