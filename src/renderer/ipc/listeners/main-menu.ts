import type { NotesEditorMode } from '@/composables/spaces/notes/useNotesApp'
import type { MainMenuLayoutMode } from '~/main/types/menu'
import {
  useApp,
  useEditor,
  useFolders,
  useMathNotebook,
  useNoteFolders,
  useNotes,
  useNotesApp,
  useNotesEditor,
  useSnippets,
} from '@/composables'
import { ipc } from '@/electron'
import { navigateBack, navigateForward } from '@/ipc/listeners/deepLinks'
import { router, RouterName } from '@/router'
import { getActiveSpaceId } from '@/spaceDefinitions'
import { EDITOR_DEFAULTS, NOTES_EDITOR_DEFAULTS } from '~/main/store/constants'
import { registerMainMenuContextSync } from '../main-menu/sync'

const { createSnippetAndSelect, addFragment } = useSnippets()
const { createFolderAndSelect } = useFolders()
const { createNoteAndSelect, selectedNote } = useNotes()
const { createNoteFolderAndSelect } = useNoteFolders()
const { createSheet } = useMathNotebook()
const { settings: editorSettings } = useEditor()
const { settings: notesEditorSettings } = useNotesEditor()
const {
  isShowCodePreview,
  isShowJsonVisualizer,
  setCodeLayoutMode,
  toggleCompactListMode,
  toggleCodeSidebar,
} = useApp()
const {
  hideNotesViewModes,
  isNotesMindmapShown,
  isNotesPresentationShown,
  notesEditorMode,
  setNotesLayoutMode,
  showNotesMindmap,
  showNotesPresentation,
  toggleNotesSidebar,
} = useNotesApp()

export function registerMainMenuListeners() {
  registerMainMenuContextSync()

  ipc.on('main-menu:goto-preferences', () => {
    router.push({ name: RouterName.preferencesStorage })
  })

  ipc.on('main-menu:goto-devtools', () => {
    router.push({ name: RouterName.devtoolsCaseConverter })
  })

  ipc.on('main-menu:navigate-back', () => {
    void navigateBack()
  })

  ipc.on('main-menu:navigate-forward', () => {
    void navigateForward()
  })

  ipc.on('main-menu:new-snippet', () => {
    createSnippetAndSelect()
  })

  ipc.on('main-menu:new-fragment', () => {
    addFragment()
  })

  ipc.on('main-menu:new-folder', () => {
    createFolderAndSelect()
  })

  ipc.on('main-menu:new-note', () => {
    createNoteAndSelect()
  })

  ipc.on('main-menu:new-note-folder', () => {
    createNoteFolderAndSelect()
  })

  ipc.on('main-menu:new-sheet', () => {
    createSheet()
  })

  ipc.on('main-menu:preview-mindmap', () => {
    if (getActiveSpaceId() !== 'notes' || !selectedNote.value) {
      return
    }

    if (isNotesMindmapShown.value) {
      hideNotesViewModes()
      return
    }

    showNotesMindmap()
  })

  ipc.on('main-menu:preview-code', () => {
    isShowCodePreview.value = !isShowCodePreview.value
  })

  ipc.on('main-menu:preview-json', () => {
    isShowJsonVisualizer.value = !isShowJsonVisualizer.value
  })

  ipc.on('main-menu:presentation-mode', () => {
    if (getActiveSpaceId() !== 'notes' || !selectedNote.value) {
      return
    }

    if (isNotesPresentationShown.value) {
      hideNotesViewModes()
      router.push({ name: RouterName.notesSpace })
      return
    }

    showNotesPresentation()
    router.push({ name: RouterName.notesPresentation })
  })

  ipc.on('main-menu:toggle-sidebar', () => {
    const activeSpaceId = getActiveSpaceId()

    if (activeSpaceId === 'code') {
      toggleCodeSidebar()
      return
    }

    if (activeSpaceId === 'notes') {
      toggleNotesSidebar()
    }
  })

  ipc.on('main-menu:toggle-compact-mode', () => {
    const activeSpaceId = getActiveSpaceId()

    if (
      activeSpaceId === 'code'
      || activeSpaceId === 'notes'
      || activeSpaceId === 'math'
    ) {
      toggleCompactListMode()
    }
  })

  ipc.on('main-menu:goto-math-notebook', () => {
    router.push({ name: RouterName.mathNotebook })
  })

  ipc.on('main-menu:set-layout-mode', (_, layoutMode?: MainMenuLayoutMode) => {
    if (!layoutMode) {
      return
    }

    const activeSpaceId = getActiveSpaceId()

    if (activeSpaceId === 'code') {
      setCodeLayoutMode(layoutMode)
      return
    }

    if (activeSpaceId === 'notes') {
      setNotesLayoutMode(layoutMode)
    }
  })

  ipc.on('main-menu:set-notes-editor-mode', (_, mode?: NotesEditorMode) => {
    if (getActiveSpaceId() !== 'notes' || !mode) {
      return
    }

    notesEditorMode.value = mode
  })

  ipc.on('main-menu:font-size-increase', () => {
    if (getActiveSpaceId() === 'notes') {
      notesEditorSettings.fontSize++
      return
    }

    editorSettings.fontSize++
  })

  ipc.on('main-menu:font-size-decrease', () => {
    if (getActiveSpaceId() === 'notes') {
      notesEditorSettings.fontSize--
      return
    }

    editorSettings.fontSize--
  })

  ipc.on('main-menu:font-size-reset', () => {
    if (getActiveSpaceId() === 'notes') {
      notesEditorSettings.fontSize = NOTES_EDITOR_DEFAULTS.fontSize
      return
    }

    editorSettings.fontSize = EDITOR_DEFAULTS.fontSize
  })
}
