import type { createStorageMock, MockVault } from './storageMock'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockVault } from './storageMock'

const mocks = vi.hoisted(() => ({
  userData: '',
  key: undefined as
  | {
    vault: string
    source: 'provider' | 'builtin'
    baseURL?: string
    model: string
  }
  | undefined,
  vault: undefined as unknown as MockVault,
  storage: undefined as unknown as ReturnType<typeof createStorageMock>,
  embed: vi.fn(async (_key: unknown, texts: string[]) =>
    texts.map(() => Float32Array.from([1, 0])),
  ),
}))
vi.mock('electron', () => ({
  app: { getPath: () => mocks.userData },
}))
vi.mock('../../../store', () => ({
  store: { preferences: { get: () => '/vault' } },
}))
vi.mock('../../settings', () => ({
  getAiSemanticSettings: () => ({
    source: 'provider',
    provider: {
      kind: 'ollama',
      baseURL: 'http://localhost:11434/v1',
      model: 'embed',
    },
  }),
}))
vi.mock('../embeddings', async importOriginal => ({
  ...(await importOriginal<typeof import('../embeddings')>()),
  currentSemanticKey: () => mocks.key,
  embedTexts: mocks.embed,
}))
vi.mock('../../../storage', async () => {
  const { createStorageMock } = await import('./storageMock')
  mocks.storage = createStorageMock(() => mocks.vault)
  return mocks.storage.module
})

const key = {
  vault: '/vault',
  source: 'provider' as const,
  baseURL: 'http://localhost:11434/v1',
  model: 'embed',
}
function indexFile() {
  return path.join(mocks.userData, 'v2', 'ai-semantic', 'index.json')
}
function embeddedTexts() {
  return mocks.embed.mock.calls.flatMap(call => call[1])
}

beforeEach(() => {
  vi.resetModules()
  mocks.userData = fs.mkdtempSync(path.join(os.tmpdir(), 'masscode-semantic-'))
  mocks.key = { ...key }
  mocks.vault = createMockVault()
  mocks.vault.notes = [
    { id: 1, name: 'One', content: 'first note about deployments' },
    { id: 2, name: 'Two', content: 'second note about retries' },
  ]
  mocks.embed.mockReset()
})
afterEach(() => {
  fs.rmSync(mocks.userData, { recursive: true, force: true })
})

describe('planIndexUpdate', () => {
  it('embeds new and changed records, deletes removed ones, keeps pending vectors and copies moved ones', async () => {
    const { planIndexUpdate } = await import('../vectorIndex')
    const stored = (h: string) => ({ h, chunks: [] })
    const record = { type: 'note' as const, id: 0, name: '', content: '' }
    const entry = (ref: string, h: string, pending = false) => ({
      ref,
      sig: 's',
      pending,
      name: ref,
      ...(pending ? {} : { record, h }),
    })
    const plan = planIndexUpdate(
      new Map([
        ['note:1', stored('same')],
        ['note:2', stored('old')],
        ['note:3', stored('moved')],
        ['note:4', stored('old')],
        ['note:6', stored('gone')],
      ]),
      [
        entry('note:1', 'same'),
        entry('note:2', 'new'),
        entry('note:4', '', true),
        entry('note:5', 'new'),
        entry('note:9', 'moved'),
      ],
    )
    expect(plan.toEmbed.map(item => item.ref)).toEqual(['note:2', 'note:5'])
    expect(plan.toCopy.map(item => [item.entry.ref, item.from.h])).toEqual([
      ['note:9', 'moved'],
    ])
    expect(plan.toDelete).toEqual(['note:3', 'note:6'])
  })
})

describe('index lifecycle', () => {
  const builtin = {
    vault: '/vault',
    source: 'builtin' as const,
    model: 'embeddinggemma',
  }
  it('reports indexing right after a restart and the count when done', async () => {
    const { restartIndex, semanticStatus } = await import('../vectorIndex')
    const run = restartIndex()
    expect((await semanticStatus()).index).toMatchObject({
      state: 'indexing',
      complete: false,
    })
    await run
    expect((await semanticStatus()).index).toEqual({
      state: 'idle',
      indexed: 2,
      complete: true,
    })
  })
  it('goes off after the model is removed and rebuilds at once after the download', async () => {
    mocks.key = builtin
    const { removeIndex, restartIndex, semanticStatus, syncIndex }
      = await import('../vectorIndex')
    await syncIndex()
    mocks.key = undefined
    await removeIndex('builtin')
    expect(fs.existsSync(indexFile())).toBe(false)
    expect((await semanticStatus()).index).toEqual({
      state: 'off',
      indexed: 0,
      complete: false,
    })
    mocks.key = builtin
    const run = restartIndex()
    expect((await semanticStatus()).index.state).toBe('indexing')
    await run
    expect((await semanticStatus()).index).toEqual({
      state: 'idle',
      indexed: 2,
      complete: true,
    })
    expect(mocks.embed).toHaveBeenCalledTimes(2)
  })
  it('keeps and saves the rebuilt index while Preferences polls the status during the run', async () => {
    mocks.key = builtin
    const { removeIndex, restartIndex, semanticStatus, syncIndex }
      = await import('../vectorIndex')
    await syncIndex()
    mocks.key = undefined
    await removeIndex('builtin')
    mocks.key = builtin
    // Опрос раз в секунду попадает на загрузку индекса с диска посреди прогона.
    const polls = [semanticStatus()]
    const run = restartIndex()
    polls.push(semanticStatus(), semanticStatus())
    await Promise.all([run, ...polls])
    expect((await semanticStatus()).index).toEqual({
      state: 'idle',
      indexed: 2,
      complete: true,
    })
    expect(fs.existsSync(indexFile())).toBe(true)
  })
  it('leaves no index on disk or in memory when a run restarts while it is being removed', async () => {
    mocks.key = builtin
    const { readIndex, removeIndex, restartIndex, syncIndex } = await import(
      '../vectorIndex'
    )
    await syncIndex()
    mocks.vault.notes[0] = {
      ...mocks.vault.notes[0],
      sig: 'edited',
      content: 'edited note about rollbacks',
    }
    let release!: () => void
    mocks.embed.mockImplementationOnce(async (_key, texts) => {
      await new Promise<void>((resolve) => {
        release = resolve
      })
      return texts.map(() => Float32Array.from([1, 0]))
    })
    const run = syncIndex()
    await vi.waitFor(() => expect(release).toBeDefined())
    // Удаление сменит поколение: прогон начнётся заново и перечитает ещё не удалённый файл.
    const removing = removeIndex('builtin')
    release()
    await Promise.all([run, removing])
    expect(fs.existsSync(indexFile())).toBe(false)
    expect(await readIndex()).toBeUndefined()
    mocks.embed.mockClear()
    await restartIndex()
    expect(mocks.embed).toHaveBeenCalled()
  })
  it('keeps the index of another source that started while the built-in one was being removed', async () => {
    mocks.key = builtin
    const { readIndex, removeIndex, restartIndex, syncIndex } = await import(
      '../vectorIndex'
    )
    await syncIndex()
    mocks.vault.notes[0] = {
      ...mocks.vault.notes[0],
      sig: 'edited',
      content: 'edited note about rollbacks',
    }
    let release!: () => void
    mocks.embed.mockImplementationOnce(async (_key, texts) => {
      await new Promise<void>((resolve) => {
        release = resolve
      })
      return texts.map(() => Float32Array.from([1, 0]))
    })
    const run = syncIndex()
    await vi.waitFor(() => expect(release).toBeDefined())
    const removing = removeIndex('builtin')
    // Пользователь переключился на провайдера, пока удаление ждёт выхода прогона.
    mocks.key = { ...key }
    const restarted = restartIndex()
    release()
    await Promise.all([run, restarted, removing])
    expect((await readIndex())?.fingerprint).toMatchObject({
      source: 'provider',
      model: 'embed',
    })
    expect((await readIndex())?.complete).toBe(true)
    expect(
      JSON.parse(fs.readFileSync(indexFile(), 'utf8')).fingerprint.source,
    ).toBe('provider')
  })
  it('keeps the cache of another source that was built while the file was being removed', async () => {
    mocks.key = builtin
    const { readIndex, removeIndex, restartIndex, syncIndex } = await import(
      '../vectorIndex'
    )
    await syncIndex()
    const fsp = (await import('node:fs/promises')).default
    const rm = fsp.rm
    let release!: () => void
    const rmSpy = vi
      .spyOn(fsp, 'rm')
      .mockImplementationOnce(async (...args) => {
        await new Promise<void>((resolve) => {
          release = resolve
        })
        return rm(...args)
      })
    try {
      const removing = removeIndex('builtin')
      await vi.waitFor(() => expect(release).toBeDefined())
      mocks.key = { ...key }
      await restartIndex()
      release()
      await removing
    }
    finally {
      rmSpy.mockRestore()
    }
    expect((await readIndex())?.fingerprint).toMatchObject({
      source: 'provider',
      model: 'embed',
    })
    expect(
      JSON.parse(fs.readFileSync(indexFile(), 'utf8')).fingerprint.source,
    ).toBe('provider')
  })
  it('shows the ready index at once after the source is switched off and back on', async () => {
    const { restartIndex, semanticStatus, syncIndex } = await import(
      '../vectorIndex'
    )
    await syncIndex()
    mocks.key = undefined
    await restartIndex()
    expect((await semanticStatus()).index.state).toBe('off')
    mocks.key = { ...key }
    const run = restartIndex()
    expect((await semanticStatus()).index).toEqual({
      state: 'idle',
      indexed: 2,
      complete: true,
    })
    await run
    expect(mocks.embed).toHaveBeenCalledTimes(1)
    // Догоняющая синхронизация после включения действительно идёт.
    mocks.vault.notes[0] = {
      ...mocks.vault.notes[0],
      sig: 'edited',
      content: 'edited note about rollbacks',
    }
    await (await import('../vectorIndex')).syncIndex()
    expect(mocks.embed).toHaveBeenCalledTimes(2)
  })
  it('does not get stuck after a restart without a key', async () => {
    const { restartIndex, semanticStatus } = await import('../vectorIndex')
    mocks.key = undefined
    await restartIndex()
    mocks.key = { ...key }
    await restartIndex()
    expect(mocks.embed).toHaveBeenCalledTimes(1)
    expect((await semanticStatus()).index).toEqual({
      state: 'idle',
      indexed: 2,
      complete: true,
    })
  })
  it('indexes after switching to the built-in model before it was downloaded', async () => {
    const { restartIndex, semanticStatus } = await import('../vectorIndex')
    mocks.key = undefined
    await restartIndex()
    expect((await semanticStatus()).index.state).toBe('off')
    mocks.key = builtin
    await restartIndex()
    expect(mocks.embed).toHaveBeenCalledTimes(1)
    expect((await semanticStatus()).index).toEqual({
      state: 'idle',
      indexed: 2,
      complete: true,
    })
  })
  it('rebuilds after off, on, remove and download in this order', async () => {
    const { removeIndex, restartIndex, semanticStatus } = await import(
      '../vectorIndex'
    )
    mocks.key = undefined
    await restartIndex()
    mocks.key = builtin
    await restartIndex()
    expect((await semanticStatus()).index).toMatchObject({
      state: 'idle',
      indexed: 2,
    })
    mocks.key = undefined
    await removeIndex('builtin')
    expect((await semanticStatus()).index.state).toBe('off')
    mocks.key = builtin
    const run = restartIndex()
    expect((await semanticStatus()).index.state).toBe('indexing')
    await run
    expect(mocks.embed).toHaveBeenCalledTimes(2)
    expect(fs.existsSync(indexFile())).toBe(true)
    expect((await semanticStatus()).index).toEqual({
      state: 'idle',
      indexed: 2,
      complete: true,
    })
  })
  it('reports a saved index at startup without embedding', async () => {
    await (await import('../vectorIndex')).syncIndex()
    vi.resetModules()
    mocks.embed.mockClear()
    const { semanticStatus } = await import('../vectorIndex')
    expect((await semanticStatus()).index).toEqual({
      state: 'idle',
      indexed: 2,
      complete: true,
    })
    expect(mocks.embed).not.toHaveBeenCalled()
  })
  it('finishes a partial index found at startup without waiting for a search', async () => {
    mocks.vault.notes = [1, 2, 3].map(id => ({
      id,
      name: `Long ${id}`,
      content: 'abc,, '.repeat(299),
    }))
    mocks.key = builtin
    const { AiError } = await import('../../errors')
    mocks.embed
      .mockImplementationOnce(async (_key, texts) =>
        texts.map(() => Float32Array.from([1, 0])),
      )
      .mockRejectedValueOnce(new AiError('connection'))
    await (await import('../vectorIndex')).syncIndex()
    vi.resetModules()
    const { semanticStatus, syncIndex } = await import('../vectorIndex')
    expect((await semanticStatus()).index).toMatchObject({
      state: 'indexing',
      indexed: 2,
      complete: false,
    })
    await syncIndex()
    expect((await semanticStatus()).index).toEqual({
      state: 'idle',
      indexed: 3,
      complete: true,
    })
  })
  it('restarts with the new model when a download finishes during a run', async () => {
    const { restartIndex, semanticStatus, syncIndex } = await import(
      '../vectorIndex'
    )
    let release!: () => void
    mocks.embed.mockImplementationOnce(async (_key, texts) => {
      await new Promise<void>((resolve) => {
        release = resolve
      })
      return texts.map(() => Float32Array.from([1, 0]))
    })
    const first = syncIndex()
    await vi.waitFor(() => expect(release).toBeDefined())
    mocks.key = builtin
    const second = restartIndex()
    expect(second).toBe(first)
    release()
    await second
    expect((await semanticStatus()).index).toEqual({
      state: 'idle',
      indexed: 2,
      complete: true,
    })
    expect(mocks.embed.mock.calls.at(-1)![0]).toEqual(builtin)
  })
})

describe('syncIndex', () => {
  it('builds and persists the v2 index, then skips unchanged records', async () => {
    const { loadIndex, semanticStatus, syncIndex } = await import(
      '../vectorIndex'
    )
    await syncIndex()
    expect(mocks.embed).toHaveBeenCalledTimes(1)
    expect(embeddedTexts()).toEqual([
      'One\nfirst note about deployments',
      'Two\nsecond note about retries',
    ])
    const saved = await loadIndex(indexFile())
    expect(saved?.fingerprint).toEqual({ ...key, dims: 2, chunking: 'v4' })
    expect([...saved!.records.keys()]).toEqual(['note:1', 'note:2'])
    expect(saved!.complete).toBe(true)
    expect(saved!.records.get('note:1')).toMatchObject({
      // Второй чанк — название заметки: слишком короткое, без вектора.
      chunks: [
        { n: 0, title: 'One', hasWords: true, v: Float32Array.from([1, 0]) },
        { n: 1, title: 'One', hasWords: false, v: null },
      ],
    })
    await syncIndex()
    expect(mocks.embed).toHaveBeenCalledTimes(1)
    expect((await semanticStatus()).index).toEqual({
      state: 'idle',
      indexed: 2,
      complete: true,
    })
  })
  it('does not embed records waiting for a cloud download', async () => {
    mocks.vault.notes[1].pendingCloudDownload = true
    const { readIndex, syncIndex } = await import('../vectorIndex')
    await syncIndex()
    expect([...(await readIndex())!.records.keys()]).toEqual(['note:1'])
  })
  it('stores chunks without words without vectors', async () => {
    mocks.vault.notes = [
      { id: 1, name: 'Dump', content: '0x00 0x01 0x02 0x03 0x04 0x05' },
    ]
    const { readIndex, syncIndex } = await import('../vectorIndex')
    await syncIndex()
    expect(mocks.embed).not.toHaveBeenCalled()
    expect((await readIndex())!.records.get('note:1')?.chunks).toEqual([
      { n: 0, title: 'Dump', hasWords: false, v: null },
      { n: 1, title: 'Dump', hasWords: false, v: null },
    ])
  })
  it('deletes the index of another model and rebuilds it', async () => {
    const first = await import('../vectorIndex')
    await first.syncIndex()
    vi.resetModules()
    mocks.key = { ...key, model: 'other' }
    mocks.vault.notes = [mocks.vault.notes[0]]
    const second = await import('../vectorIndex')
    await second.syncIndex()
    const saved = await second.loadIndex(indexFile())
    expect(saved?.fingerprint.model).toBe('other')
    expect([...saved!.records.keys()]).toEqual(['note:1'])
    expect(mocks.embed).toHaveBeenCalledTimes(2)
  })
  it('rebuilds an index file of the previous format', async () => {
    fs.mkdirSync(path.dirname(indexFile()), { recursive: true })
    fs.writeFileSync(
      indexFile(),
      JSON.stringify({
        version: 1,
        key: { ...key, dims: 2 },
        items: { 'note:1': { h: 'x', v: 'AACAPwAAAAA=' } },
      }),
    )
    const { loadIndex, syncIndex } = await import('../vectorIndex')
    expect(await loadIndex(indexFile())).toBeUndefined()
    await syncIndex()
    expect(embeddedTexts()).toHaveLength(2)
    expect((await loadIndex(indexFile()))?.records.size).toBe(2)
  })
  it('copies vectors of a record that came back under a new id', async () => {
    const { readIndex, syncIndex } = await import('../vectorIndex')
    await syncIndex()
    mocks.vault.notes[0] = { ...mocks.vault.notes[0], id: 3, sig: 'sig-3' }
    await syncIndex()
    expect(mocks.embed).toHaveBeenCalledTimes(1)
    expect([...(await readIndex())!.records.keys()].sort()).toEqual([
      'note:2',
      'note:3',
    ])
  })
  it('reports progress in chunks and ranks a changed record by its old vectors until re-embedded', async () => {
    const { readPreparedVectors, semanticStatus, syncIndex } = await import(
      '../vectorIndex'
    )
    await syncIndex()
    mocks.vault.notes[0] = {
      ...mocks.vault.notes[0],
      sig: 'edited',
      content: `${'long words '.repeat(400)}tail`,
    }
    let seen: { status?: unknown, refs?: string[] } = {}
    mocks.embed.mockImplementationOnce(async (_key, texts) => {
      seen = {
        status: (await semanticStatus()).index,
        refs: (await readPreparedVectors(key))?.chunks.map(
          chunk => chunk.ref,
        ),
      }
      return texts.map(() => Float32Array.from([0, 1]))
    })
    await syncIndex()
    expect(seen.status).toEqual({
      state: 'indexing',
      indexed: 2,
      complete: true,
      done: 0,
      total: 3,
    })
    expect(seen.refs).toEqual(['note:1', 'note:2'])
  })
  it('reports embedding failures and keeps the status readable', async () => {
    const { AiError } = await import('../../errors')
    mocks.embed.mockRejectedValueOnce(new AiError('connection'))
    const { semanticStatus, syncIndex } = await import('../vectorIndex')
    await syncIndex()
    expect((await semanticStatus()).index).toEqual({
      state: 'error',
      indexed: 0,
      complete: false,
      error: 'connection',
    })
  })
  it('does not retry a failed key in the background until restarted', async () => {
    const { AiError } = await import('../../errors')
    mocks.embed.mockRejectedValueOnce(new AiError('connection'))
    const { restartIndex, syncIndex, syncIndexInBackground } = await import(
      '../vectorIndex'
    )
    await syncIndex()
    syncIndexInBackground({ ...key })
    expect(mocks.embed).toHaveBeenCalledTimes(1)
    await restartIndex()
    expect(mocks.embed).toHaveBeenCalledTimes(2)
  })
  it('splits builtin batches by the token budget but not provider batches', async () => {
    // Три заметки в один чанк примерно по 800 оценённых токенов: в бюджет builtin помещаются только две.
    mocks.vault.notes = [1, 2, 3].map(id => ({
      id,
      name: `Long ${id}`,
      content: 'abc,, '.repeat(299),
    }))
    const { syncIndex } = await import('../vectorIndex')
    const { BATCH_LIMITS } = await import('../batching')
    mocks.key = { vault: '/vault', source: 'builtin', model: 'embeddinggemma' }
    await syncIndex()
    expect(BATCH_LIMITS.builtin.tokens).toBeLessThan(3 * 800)
    expect(mocks.embed.mock.calls.map(call => call[1].length)).toEqual([
      2,
      1,
    ])
    vi.resetModules()
    mocks.embed.mockClear()
    mocks.key = { ...key, model: 'embed-2' }
    await (await import('../vectorIndex')).syncIndex()
    expect(mocks.embed.mock.calls.map(call => call[1].length)).toEqual([3])
  })
  it('keeps the index that a sync fills when another reader loads in parallel', async () => {
    await (await import('../vectorIndex')).syncIndex()
    vi.resetModules()
    mocks.vault.notes.push({
      id: 3,
      name: 'Three',
      content: 'third note about caching',
    })
    const { loadIndex, readIndex, syncIndex } = await import('../vectorIndex')
    // Читатель начинает загрузку с диска после старта прогона и заканчивает её позже.
    const sync = syncIndex()
    const late = readIndex()
    await Promise.all([sync, late])
    expect((await readIndex())!.records.size).toBe(3)
    expect((await loadIndex(indexFile()))?.records.size).toBe(3)
  })
  it('treats a partial index after a restart as warming and finishes it', async () => {
    const first = await import('../vectorIndex')
    const { AiError } = await import('../../errors')
    mocks.vault.notes = [1, 2, 3].map(id => ({
      id,
      name: `Long ${id}`,
      content: 'abc,, '.repeat(299),
    }))
    mocks.key = { vault: '/vault', source: 'builtin', model: 'embeddinggemma' }
    mocks.embed.mockImplementationOnce(async (_key, texts) =>
      texts.map(() => Float32Array.from([1, 0])),
    )
    mocks.embed.mockRejectedValueOnce(new AiError('connection'))
    await first.syncIndex()
    expect(await first.meaningState(mocks.key)).toBe('off')
    const partial = await first.loadIndex(indexFile())
    expect(partial).toMatchObject({ complete: false })
    expect(partial!.records.size).toBe(2)
    vi.resetModules()
    const second = await import('../vectorIndex')
    expect(await second.meaningState(mocks.key)).toBe('warming')
    expect(await second.readPreparedVectors(mocks.key)).toBeUndefined()
    await second.syncIndex()
    expect(mocks.embed).toHaveBeenCalledTimes(3)
    expect(await second.meaningState(mocks.key)).toBe('ready')
  })
  it('keeps a complete index ready after a failed catch-up sync and retries it after the next change', async () => {
    const { AiError } = await import('../../errors')
    const { meaningState, semanticStatus, syncIndex, syncIndexInBackground }
      = await import('../vectorIndex')
    await syncIndex()
    mocks.vault.notes[0] = {
      ...mocks.vault.notes[0],
      sig: 'edited',
      content: 'edited note about rollbacks',
    }
    mocks.embed.mockRejectedValueOnce(new AiError('connection'))
    await syncIndex()
    expect((await semanticStatus()).index.state).toBe('error')
    expect(await meaningState(key)).toBe('ready')
    syncIndexInBackground(key)
    expect(mocks.embed).toHaveBeenCalledTimes(2)
    syncIndexInBackground(key, true)
    await syncIndex()
    expect(mocks.embed).toHaveBeenCalledTimes(3)
    expect((await semanticStatus()).index.state).toBe('idle')
  })
  it('drops a record deleted while its batch was embedding', async () => {
    const { readIndex, syncIndex } = await import('../vectorIndex')
    const { vaultCorpus } = await import('../corpus')
    mocks.embed.mockImplementationOnce(async (_key, texts) => {
      mocks.vault.notes = [mocks.vault.notes[0]]
      await vaultCorpus.refresh()
      return texts.map(() => Float32Array.from([1, 0]))
    })
    await syncIndex()
    expect([...(await readIndex())!.records.keys()]).toEqual(['note:1'])
  })
  it('stops without an error when the key changes during embedding', async () => {
    const { readIndex, semanticStatus, syncIndex } = await import(
      '../vectorIndex'
    )
    mocks.embed.mockImplementationOnce(async (_key, texts) => {
      mocks.key = { ...key, model: 'other' }
      return texts.map(() => Float32Array.from([1, 0]))
    })
    await syncIndex()
    expect((await readIndex())!.complete).toBe(false)
    expect((await readIndex())!.records.size).toBe(0)
    // Новый ключ без индекса: статус не ошибка, а сразу запущенная сборка для него.
    expect((await semanticStatus()).index.state).toBe('indexing')
  })
  it('swallows the error of a run replaced by a restart and finishes the new one', async () => {
    const { AiError } = await import('../../errors')
    const { meaningState, restartIndex, semanticStatus, syncIndex }
      = await import('../vectorIndex')
    mocks.embed.mockImplementationOnce(async () => {
      void restartIndex()
      throw new AiError('connection')
    })
    await syncIndex()
    expect((await semanticStatus()).index.state).toBe('idle')
    expect(await meaningState(key)).toBe('ready')
    expect(mocks.embed).toHaveBeenCalledTimes(2)
  })
  it('treats a corrupted index file as empty', async () => {
    const { loadIndex } = await import('../vectorIndex')
    fs.mkdirSync(path.dirname(indexFile()), { recursive: true })
    fs.writeFileSync(indexFile(), '{"version":3,')
    expect(await loadIndex(indexFile())).toBeUndefined()
  })
})
