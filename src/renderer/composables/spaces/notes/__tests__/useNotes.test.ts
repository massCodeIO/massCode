import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, reactive, ref, shallowRef, watch } from 'vue'

globalThis.computed = computed
globalThis.reactive = reactive
globalThis.ref = ref
globalThis.shallowRef = shallowRef
globalThis.watch = watch

interface SetupOptions {
  folderId?: number
  isSearch?: boolean
  libraryFilter?: string
  nextNotes?: Array<{
    id: number
    folder?: { id: number } | null
    name?: string
  }>
  noteId?: number
  searchQuery?: string
  tagId?: number
}

async function setup(options: SetupOptions = {}) {
  vi.resetModules()

  const notesState = reactive<{
    folderId?: number
    libraryFilter?: string
    noteId?: number
    tagId?: number
  }>({
    folderId: options.folderId,
    libraryFilter: options.libraryFilter ?? 'today',
    noteId: options.noteId ?? 1,
    tagId: options.tagId,
  })
  const notesCreateKind = ref<'note' | 'task'>('note')
  const isSearch = ref(options.isSearch ?? false)
  const searchQuery = ref(options.searchQuery ?? '')
  const nextNotes = options.nextNotes ?? [{ id: 2 }]
  const patchNotesByIdProperties = vi.fn(async () => undefined)
  const getNotes = vi.fn(async () => ({ data: nextNotes }))
  const postNotes = vi.fn(async () => ({ data: { id: 7 } }))

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
        postNotes,
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
      notesCreateKind,
      notesState,
    }),
  }))

  vi.doMock('../useNoteSearch', () => ({
    isSearch,
    notesBySearch: ref(),
    searchQuery,
  }))

  const { selectedNoteIds, useNotes } = await import('../useNotes')

  return {
    getNotes,
    notesState,
    patchNotesByIdProperties,
    postNotes,
    searchQuery,
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

  it('creates a task and switches task-only filters to the task list', async () => {
    const context = await setup({
      libraryFilter: 'today',
      nextNotes: [{ id: 7, folder: null, name: 'Created Task' }],
    })

    await context.useNotes().createTaskAndSelect()

    expect(context.postNotes).toHaveBeenCalledWith({
      folderId: null,
      name: 'notes.untitled 1',
      properties: {
        status: 'todo',
        type: 'task',
      },
    })
    expect(context.notesState.libraryFilter).toBe('tasks')
    expect(context.notesState.noteId).toBe(7)
    expect(context.selectedNoteIds.value).toEqual([7])
  })

  it('creates a note and switches task filters to all notes', async () => {
    const context = await setup({
      libraryFilter: 'tasks',
      nextNotes: [{ id: 7, folder: null, name: 'Created Note' }],
    })

    await context.useNotes().createNoteAndSelect()

    expect(context.postNotes).toHaveBeenCalledWith({
      folderId: null,
      name: 'notes.untitled 1',
    })
    expect(context.notesState.libraryFilter).toBe('all')
    expect(context.notesState.noteId).toBe(7)
  })

  it('combines search with the selected tag context', async () => {
    const context = await setup({
      isSearch: true,
      searchQuery: 'migration',
      tagId: 12,
    })

    await context.useNotes().getNotes()

    expect(context.getNotes).toHaveBeenCalledWith({
      search: 'migration',
      tagId: 12,
    })
  })

  it('combines search with task library filters', async () => {
    const context = await setup({
      isSearch: true,
      libraryFilter: 'today',
      searchQuery: 'release',
    })

    await context.useNotes().getNotes()

    expect(context.getNotes).toHaveBeenCalledWith({
      propertyDue: 'today',
      propertyStatusNot: 'done',
      propertyType: 'task',
      search: 'release',
    })
  })
})
