import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, reactive, ref, shallowRef, watch } from 'vue'

globalThis.computed = computed
globalThis.reactive = reactive
globalThis.ref = ref
globalThis.shallowRef = shallowRef
globalThis.watch = watch

async function setup() {
  vi.resetModules()

  const notesState = reactive<{
    folderId?: number
    noteId?: number
    tagId?: number
    libraryFilter?: string
  }>({
    folderId: 7,
  })

  const getNoteFoldersTree = vi.fn(async () => ({
    data: [
      {
        children: [],
        createdAt: 0,
        icon: null,
        id: 7,
        isOpen: 1,
        name: 'Development',
        orderIndex: 1,
        parentId: null,
        updatedAt: 0,
      },
      {
        children: [],
        createdAt: 0,
        icon: null,
        id: 9,
        isOpen: 1,
        name: 'Learning',
        orderIndex: 2,
        parentId: null,
        updatedAt: 0,
      },
    ],
  }))

  vi.doMock('@/electron', () => ({
    i18n: {
      t: vi.fn((key: string) => key),
    },
  }))

  vi.doMock('@/utils', () => ({
    getContiguousSelection: vi.fn(
      (
        orderedIds: number[],
        anchorId: number | undefined,
        targetId: number,
      ) => {
        if (anchorId === undefined) {
          return [targetId]
        }

        const start = orderedIds.indexOf(anchorId)
        const end = orderedIds.indexOf(targetId)

        if (start === -1 || end === -1) {
          return [targetId]
        }

        const from = Math.min(start, end)
        const to = Math.max(start, end)
        return orderedIds.slice(from, to + 1)
      },
    ),
    scrollToElement: vi.fn(),
  }))

  vi.doMock('@/composables/useStorageMutation', () => ({
    markPersistedStorageMutation: vi.fn(),
  }))

  vi.doMock('@/services/api', () => ({
    api: {
      noteFolders: {
        deleteNoteFoldersById: vi.fn(),
        getNoteFoldersTree,
        patchNoteFoldersById: vi.fn(),
        postNoteFolders: vi.fn(),
      },
    },
  }))

  vi.doMock('../useNotesApp', () => ({
    useNotesApp: () => ({
      notesState,
    }),
  }))

  vi.doMock('../useNotes', () => ({
    useNotes: () => ({
      clearNotesState: vi.fn(),
      getNotes: vi.fn(),
    }),
  }))

  const module = await import('../useNoteFolders')
  const folders = module.useNoteFolders()

  await folders.getNoteFolders(false)

  return {
    notesState,
    selectedFolderIds: folders.selectedFolderIds,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useNoteFolders', () => {
  it('replaces folder selection when folderId changes programmatically', async () => {
    const context = await setup()

    expect(context.selectedFolderIds.value).toEqual([7])

    context.notesState.folderId = 9
    await nextTick()

    expect(context.selectedFolderIds.value).toEqual([9])
  })
})
