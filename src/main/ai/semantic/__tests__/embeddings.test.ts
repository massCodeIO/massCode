import { beforeEach, describe, expect, it, vi } from 'vitest'
import { currentSemanticKey, embedQuery, embedTexts } from '../embeddings'

const mocks = vi.hoisted(() => ({
  settings: {
    source: 'provider',
    provider: {
      kind: 'lmstudio',
      baseURL: 'http://127.0.0.1:1234/v1',
      model: 'embed',
    },
  },
  request: vi.fn(),
}))
vi.mock('../../settings', () => ({
  getAiSemanticSettings: () => mocks.settings,
}))
vi.mock('../../client', () => ({
  requestAiEmbeddings: mocks.request,
}))
vi.mock('../builtin', () => ({
  embedBuiltin: vi.fn(),
  isBuiltinReady: () => false,
}))
vi.mock('../../../storage/providers/markdown/runtime/paths', () => ({
  getVaultPath: () => '/vault',
}))

beforeEach(() => {
  mocks.settings = {
    source: 'provider',
    provider: {
      kind: 'lmstudio',
      baseURL: 'http://127.0.0.1:1234/v1',
      model: 'embed',
    },
  }
  mocks.request.mockReset().mockResolvedValue([[3, 4]])
})

describe('provider embeddings', () => {
  it('builds the key from the embedding server, not the chat provider', () => {
    expect(currentSemanticKey()).toEqual({
      vault: '/vault',
      source: 'provider',
      baseURL: 'http://127.0.0.1:1234/v1',
      model: 'embed',
    })
    mocks.settings.provider.model = ''
    expect(currentSemanticKey()).toBeUndefined()
  })
  it('sends no API key and stops when the server address changed', async () => {
    const key = currentSemanticKey()!
    const signal = new AbortController().signal
    expect(await embedTexts(key, ['text'], signal)).toEqual([
      Float32Array.from([0.6, 0.8]),
    ])
    expect(mocks.request).toHaveBeenCalledWith(
      {
        provider: 'lmstudio',
        baseURL: 'http://127.0.0.1:1234/v1',
        model: 'embed',
      },
      'embed',
      ['text'],
      signal,
    )
    mocks.settings.provider.baseURL = 'http://127.0.0.1:9999/v1'
    await expect(embedTexts(key, ['text'], signal)).rejects.toThrow()
    expect(mocks.request).toHaveBeenCalledTimes(1)
  })
})

describe('query embeddings', () => {
  it('reuses the vector of a repeated query', async () => {
    const key = currentSemanticKey()!
    const signal = new AbortController().signal
    const first = await embedQuery(key, 'retry with jitter', signal)
    expect(await embedQuery(key, 'retry with jitter', signal)).toBe(first)
    expect(mocks.request).toHaveBeenCalledTimes(1)
    await embedQuery({ ...key, model: 'other' }, 'retry with jitter', signal)
    expect(mocks.request).toHaveBeenCalledTimes(2)
  })
})
