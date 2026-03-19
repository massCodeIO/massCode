import {
  useApp,
  useFolders,
  useNotes,
  useNotesApp,
  useSnippets,
} from '@/composables'
import { ipc } from '@/electron'
import { router, RouterName } from '@/router'
import { getActiveSpaceId } from '@/spaceDefinitions'

const { createSnippetAndSelect, addFragment } = useSnippets()
const { createFolderAndSelect } = useFolders()
const { selectedNote } = useNotes()
const { isShowCodePreview, isShowJsonVisualizer, isSidebarHidden } = useApp()
const {
  hideNotesViewModes,
  isNotesMindmapShown,
  isNotesPresentationShown,
  showNotesMindmap,
  showNotesPresentation,
} = useNotesApp()

export function registerMainMenuListeners() {
  ipc.on('main-menu:goto-preferences', () => {
    router.push({ name: RouterName.preferencesStorage })
  })

  ipc.on('main-menu:goto-devtools', () => {
    router.push({ name: RouterName.devtoolsCaseConverter })
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
    isSidebarHidden.value = !isSidebarHidden.value
  })

  ipc.on('main-menu:goto-math-notebook', () => {
    router.push({ name: RouterName.mathNotebook })
  })
}
