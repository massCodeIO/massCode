import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

globalThis.ref = ref

async function setup() {
  vi.resetModules()

  const callOrder: string[] = []
  const isCodeSpaceInitialized = ref(false)
  const getFolders = vi.fn(async () => {
    callOrder.push('getFolders')
  })
  const getSnippets = vi.fn(async () => {
    callOrder.push('getSnippets')
  })
  const getTags = vi.fn(async () => {
    callOrder.push('getTags')
  })
  const normalizeCodeSelectionState = vi.fn(async () => {
    callOrder.push('normalizeCodeSelectionState')
  })

  vi.doMock('../useApp', () => ({
    useApp: () => ({
      isCodeSpaceInitialized,
    }),
  }))

  vi.doMock('../useFolders', () => ({
    useFolders: () => ({
      getFolders,
    }),
  }))

  vi.doMock('../useTags', () => ({
    useTags: () => ({
      getTags,
    }),
  }))

  vi.doMock('../useSnippets', () => ({
    useSnippets: () => ({
      getSnippets,
    }),
  }))

  vi.doMock('../useCodeSelectionNormalization', () => ({
    normalizeCodeSelectionState,
  }))

  const { initCodeSpace } = await import('../useCodeSpaceInit')

  return {
    callOrder,
    initCodeSpace,
    isCodeSpaceInitialized,
    normalizeCodeSelectionState,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('initCodeSpace', () => {
  it('loads folders and tags before normalizing selection state', async () => {
    const context = await setup()

    await context.initCodeSpace()

    expect(context.callOrder).toEqual([
      'getFolders',
      'getTags',
      'normalizeCodeSelectionState',
    ])
    expect(context.isCodeSpaceInitialized.value).toBe(true)
  })
})
