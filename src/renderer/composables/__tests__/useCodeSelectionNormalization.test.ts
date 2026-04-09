import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, reactive, ref } from 'vue'

globalThis.computed = computed
globalThis.reactive = reactive
globalThis.ref = ref

interface FolderNode {
  id: number
  children: FolderNode[]
}

interface SetupOptions {
  displayedSnippetIds?: number[]
  folderId?: number
  folders?: FolderNode[]
  snippetId?: number
  tagId?: number
  tags?: Array<{ id: number, name: string }>
}

async function setup(options: SetupOptions = {}) {
  vi.resetModules()

  const state = reactive<{
    folderId?: number
    libraryFilter?: string
    snippetId?: number
    tagId?: number
  }>({
    folderId: options.folderId,
    snippetId: options.snippetId,
    tagId: options.tagId,
  })

  const folders = ref<FolderNode[] | undefined>(
    options.folders ?? [
      { id: 7, children: [] },
      { id: 9, children: [] },
    ],
  )
  const tags = ref(options.tags ?? [{ id: 1, name: 'work' }])
  const displayedSnippets = ref(
    (options.displayedSnippetIds ?? []).map(id => ({ id })),
  )

  const getSnippets = vi.fn(async () => undefined)
  const selectFirstSnippet = vi.fn(() => {
    state.snippetId = displayedSnippets.value[0]?.id
  })

  vi.doMock('../useApp', () => ({
    useApp: () => ({
      state,
    }),
  }))

  vi.doMock('../useFolders', () => ({
    useFolders: () => ({
      folders,
    }),
  }))

  vi.doMock('../useTags', () => ({
    useTags: () => ({
      tags,
    }),
  }))

  vi.doMock('../useSnippets', () => ({
    useSnippets: () => ({
      displayedSnippets,
      getSnippets,
      selectFirstSnippet,
    }),
  }))

  const { normalizeCodeSelectionState } = await import(
    '../useCodeSelectionNormalization'
  )

  return {
    displayedSnippets,
    folders,
    getSnippets,
    normalizeCodeSelectionState,
    selectFirstSnippet,
    state,
    tags,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('normalizeCodeSelectionState', () => {
  it('clears stale tagId before requesting snippets', async () => {
    const context = await setup({
      folderId: 7,
      tagId: 999,
    })

    await context.normalizeCodeSelectionState()

    expect(context.state.tagId).toBeUndefined()
    expect(context.getSnippets).toHaveBeenCalledTimes(1)
  })

  it('falls back to the first folder when saved folderId is missing', async () => {
    const context = await setup({
      folderId: 999,
      folders: [
        { id: 7, children: [] },
        { id: 9, children: [] },
      ],
    })

    await context.normalizeCodeSelectionState()

    expect(context.state.folderId).toBe(7)
    expect(context.getSnippets).toHaveBeenCalledTimes(1)
  })

  it('selects the first snippet when saved snippetId is absent from the list', async () => {
    const context = await setup({
      displayedSnippetIds: [1, 2],
      folderId: 7,
      snippetId: 42,
    })

    await context.normalizeCodeSelectionState()

    expect(context.selectFirstSnippet).toHaveBeenCalledTimes(1)
    expect(context.state.snippetId).toBe(1)
  })
})
