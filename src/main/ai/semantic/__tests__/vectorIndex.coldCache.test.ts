import type { createStorageMock, MockVault } from './storageMock'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockVault } from './storageMock'

const BODY = '# Inventory deployment: web and db groups for staging'

const mocks = vi.hoisted(() => ({
  userData: '',
  vault: undefined as unknown as MockVault,
  storage: undefined as unknown as ReturnType<typeof createStorageMock>,
  embed: vi.fn(async (_key: unknown, texts: string[]) =>
    texts.map(() => Float32Array.from([1, 0])),
  ),
}))
vi.mock('electron', () => ({
  app: { getPath: () => mocks.userData },
  BrowserWindow: { getAllWindows: () => [] },
}))
vi.mock('../../../store', () => ({
  store: { preferences: { get: () => '/vault' } },
}))
vi.mock('../../settings', () => ({
  getAiSemanticSettings: () => ({ source: 'off' }),
}))
vi.mock('../embeddings', async importOriginal => ({
  ...(await importOriginal<typeof import('../embeddings')>()),
  currentSemanticKey: () => ({
    vault: '/vault',
    source: 'builtin',
    model: 'embed',
  }),
  embedTexts: mocks.embed,
}))
vi.mock('../../../storage', async () => {
  const { createStorageMock } = await import('./storageMock')
  mocks.storage = createStorageMock(() => mocks.vault)
  return mocks.storage.module
})

beforeEach(() => {
  vi.resetModules()
  mocks.userData = fs.mkdtempSync(path.join(os.tmpdir(), 'masscode-semantic-'))
  mocks.vault = createMockVault()
  mocks.embed.mockClear()
})
afterEach(() => {
  fs.rmSync(mocks.userData, { recursive: true, force: true })
})

// Баг 1: холодный runtime-кэш собирает список сниппетов из метаданных state без тел (value: null),
// прогрев эмбеддил только имя, потом хэш менялся и запись выпадала из поиска.
describe('indexing on a cold runtime cache', () => {
  it('embeds snippet bodies hydrated one by one', async () => {
    mocks.vault.snippets = [
      {
        id: 1,
        name: 'Staging hosts',
        contents: [{ label: 'hosts.ini', language: 'ini', value: BODY }],
      },
    ]
    const { syncIndex } = await import('../vectorIndex')
    await syncIndex()
    expect(
      mocks.embed.mock.calls
        .flatMap(call => call[1])
        .some(text => text.includes('Inventory deployment')),
    ).toBe(true)
  })
  it('embeds snippet bodies hydrated through the full list on the warm-up', async () => {
    mocks.vault.snippets = Array.from({ length: 60 }, (_, index) => ({
      id: index + 1,
      name: `Hosts ${index}`,
      contents: [
        { label: 'hosts.ini', language: 'ini', value: `${BODY} ${index}` },
      ],
    }))
    const { syncIndex } = await import('../vectorIndex')
    await syncIndex()
    const texts = mocks.embed.mock.calls.flatMap(call => call[1])
    expect(
      texts.filter(text => text.includes('Inventory deployment')),
    ).toHaveLength(60)
  })
})
