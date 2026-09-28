import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, reactive, ref, watch } from 'vue'

globalThis.computed = computed
globalThis.reactive = reactive
globalThis.ref = ref
globalThis.watch = watch

const storeGet = vi.fn()
const storeSet = vi.fn()

async function setup(inspectorTab = 'links') {
  vi.resetModules()

  storeGet.mockImplementation((key: string) => {
    if (key === 'notes.layout.inspectorTab')
      return inspectorTab

    if (key === 'notes.selection') {
      return {}
    }

    if (key === 'notes.editorMode') {
      return 'livePreview'
    }

    if (key === 'notes.layout.mode') {
      return 'all-panels'
    }
  })

  vi.doMock('@/electron', () => ({
    store: {
      app: {
        get: storeGet,
        set: storeSet,
      },
    },
  }))

  const { useNotesApp } = await import('../useNotesApp')

  return useNotesApp()
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useNotesApp', () => {
  it('restores and shares the inspector tab across notes and component instances', async () => {
    const notesApp = await setup('outline')
    expect(notesApp.notesInspectorTab.value).toBe('outline')
    notesApp.notesState.noteId = 42
    expect(notesApp.notesInspectorTab.value).toBe('outline')
    notesApp.notesInspectorTab.value = 'links'
    await nextTick()
    expect(storeSet).toHaveBeenCalledWith('notes.layout.inspectorTab', 'links')
    const { useNotesApp } = await import('../useNotesApp')
    expect(useNotesApp().notesInspectorTab).toBe(notesApp.notesInspectorTab)
  })

  it('restores all notes panels after clearing search', async () => {
    const notesApp = await setup()

    notesApp.setNotesLayoutMode('all-panels')
    notesApp.saveNotesStateSnapshot('beforeSearch')

    notesApp.setNotesLayoutMode('list-editor')
    notesApp.restoreNotesStateSnapshot('beforeSearch')

    expect(notesApp.notesLayoutMode.value).toBe('all-panels')
    expect(notesApp.isNotesSidebarHidden.value).toBe(false)
    expect(notesApp.isNotesListHidden.value).toBe(false)
  })

  it('restores editor-only notes layout after clearing search', async () => {
    const notesApp = await setup()

    notesApp.setNotesLayoutMode('editor-only')
    notesApp.saveNotesStateSnapshot('beforeSearch')

    notesApp.setNotesLayoutMode('all-panels')
    notesApp.restoreNotesStateSnapshot('beforeSearch')

    expect(notesApp.notesLayoutMode.value).toBe('editor-only')
    expect(notesApp.isNotesSidebarHidden.value).toBe(true)
    expect(notesApp.isNotesListHidden.value).toBe(true)
  })
})
