import { beforeEach, describe, expect, it, vi } from 'vitest'
import { currentSemanticKey, embedQuery, embedTexts } from '../embeddings'

const mocks = vi.hoisted(() => ({
  source: 'builtin',
  ready: true,
  embed: vi.fn(),
}))
vi.mock('../../settings', () => ({
  getAiSemanticSettings: () => ({ source: mocks.source }),
}))
vi.mock('../builtin', () => ({
  embedBuiltin: mocks.embed,
  isBuiltinReady: () => mocks.ready,
}))
vi.mock('../builtinModel', () => ({
  BUILTIN_MODEL: { id: 'org/embeddinggemma', revision: 'abc' },
}))
vi.mock('../../../storage/providers/markdown/runtime/paths', () => ({
  getVaultPath: () => '/vault',
}))

beforeEach(() => {
  mocks.source = 'builtin'
  mocks.ready = true
  mocks.embed
    .mockReset()
    .mockImplementation(async (texts: string[]) => texts.map(() => [3, 4]))
})

describe('builtin embeddings', () => {
  it('builds the key only when the built-in model is selected and ready', () => {
    expect(currentSemanticKey()).toEqual({
      vault: '/vault',
      source: 'builtin',
      model: 'org/embeddinggemma@abc',
    })
    mocks.ready = false
    expect(currentSemanticKey()).toBeUndefined()
    mocks.ready = true
    mocks.source = 'off'
    expect(currentSemanticKey()).toBeUndefined()
  })
  it('normalizes vectors and rejects mismatched batches', async () => {
    const key = currentSemanticKey()!
    const signal = new AbortController().signal
    expect(await embedTexts(key, ['text'], signal)).toEqual([
      Float32Array.from([0.6, 0.8]),
    ])
    mocks.embed.mockResolvedValueOnce([[1]])
    await expect(embedTexts(key, ['a', 'b'], signal)).rejects.toMatchObject({
      code: 'invalidResponse',
    })
  })
})

describe('query embeddings', () => {
  it('reuses the vector of a repeated query', async () => {
    const key = currentSemanticKey()!
    const signal = new AbortController().signal
    const first = await embedQuery(key, 'retry with jitter', signal)
    expect(await embedQuery(key, 'retry with jitter', signal)).toBe(first)
    expect(mocks.embed).toHaveBeenCalledTimes(1)
    expect(mocks.embed).toHaveBeenCalledWith(
      ['task: search result | query: retry with jitter'],
      signal,
    )
    await embedQuery({ ...key, model: 'other' }, 'retry with jitter', signal)
    expect(mocks.embed).toHaveBeenCalledTimes(2)
  })
})
