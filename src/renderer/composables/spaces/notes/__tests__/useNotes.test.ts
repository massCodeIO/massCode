import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, reactive, ref, shallowRef, watch } from 'vue'

globalThis.computed = computed
globalThis.reactive = reactive
globalThis.ref = ref
globalThis.shallowRef = shallowRef
globalThis.watch = watch

interface SetupOptions {
  nextNotes?: Array<{ id: number }>
  noteId?: number
}

async function setup(options: SetupOptions = {}) {
  vi.resetModules()

  const notesState = reactive<{
    libraryFilter?: string
    noteId?: number
  }>({
    libraryFilter: 'today',
    noteId: options.noteId ?? 1,
  })
  const nextNotes = options.nextNotes ?? [{ id: 2 }]
  const patchNotesByIdProperties = vi.fn(async () => undefined)
  const getNotes = vi.fn(async () => ({ data: nextNotes }))

  vi.doMock('@/composables/useDialog', () => ({
    useDialog: () => ({
      confirm: vi.fn(async () => true),
    }),
  }))

  vi.doMock('@/composables/useDonations', () => ({
    useDonations: () => ({
      incrementCopy: vi.fn(),
      incrementCreated: vi.fn(),
    }),
  }))

  vi.doMock('@/composables/useStorageMutation', () => ({
    markPersistedStorageMutation: vi.fn(),
  }))

  vi.doMock('@/electron', () => ({
    i18n: {
      t: (key: string) => key,
    },
  }))

  vi.doMock('@/utils', () => ({
    getContiguousSelection: vi.fn(() => []),
  }))

  vi.doMock('~/renderer/services/api', () => ({
    api: {
      notes: {
        deleteNotesById: vi.fn(),
        deleteNotesTrash: vi.fn(),
        deleteNotesByIdTagsByTagId: vi.fn(),
        getNotes,
        patchNotesById: vi.fn(),
        patchNotesByIdContent: vi.fn(),
        patchNotesByIdProperties,
        postNotes: vi.fn(),
        postNotesByIdTagsByTagId: vi.fn(),
      },
    },
  }))

  vi.doMock('../useNoteContent', () => ({
    useNoteContent: () => ({
      hasBusyNoteContentUpdates: ref(false),
      updateNoteContent: vi.fn(),
    }),
  }))

  vi.doMock('../useNotesApp', () => ({
    useNotesApp: () => ({
      focusNoteNameInput: vi.fn(),
      notesState,
    }),
  }))

  vi.doMock('../useNoteSearch', () => ({
    isSearch: ref(false),
    notesBySearch: ref(),
    searchQuery: ref(''),
  }))

  const { selectedNoteIds, useNotes } = await import('../useNotes')

  return {
    getNotes,
    notesState,
    patchNotesByIdProperties,
    selectedNoteIds,
    useNotes,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useNotes', () => {
  it('selects the first note after property updates remove the current note from the active list', async () => {
    const context = await setup({
      nextNotes: [{ id: 2 }],
      noteId: 1,
    })

    await context.useNotes().updateNoteProperties(1, {
      properties: { status: 'done' },
    })

    expect(context.patchNotesByIdProperties).toHaveBeenCalledWith('1', {
      properties: { status: 'done' },
    })
    expect(context.getNotes).toHaveBeenCalledWith({
      propertyDue: 'today',
      propertyStatusNot: 'done',
      propertyType: 'task',
    })
    expect(context.notesState.noteId).toBe(2)
    expect(context.selectedNoteIds.value).toEqual([2])
  })

  it('keeps the current selection when property updates leave it in the active list', async () => {
    const context = await setup({
      nextNotes: [{ id: 1 }, { id: 2 }],
      noteId: 1,
    })

    await context.useNotes().updateNoteProperties(1, {
      properties: { priority: 'high' },
    })

    expect(context.notesState.noteId).toBe(1)
    expect(context.selectedNoteIds.value).toEqual([1])
  })
})
