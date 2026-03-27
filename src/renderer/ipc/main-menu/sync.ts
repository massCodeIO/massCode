import { useApp, useNotes, useNotesApp, useSnippets } from '@/composables'
import { ipc } from '@/electron'
import { getActiveSpaceId } from '@/spaceDefinitions'
import { createMainMenuContext } from './context'

const { codeLayoutMode, isShowCodePreview, isShowJsonVisualizer } = useApp()
const { selectedNote } = useNotes()
const {
  isNotesMindmapShown,
  isNotesPresentationShown,
  notesEditorMode,
  notesLayoutMode,
} = useNotesApp()
const { isAvailableToCodePreview, selectedSnippetContent } = useSnippets()

export function registerMainMenuContextSync() {
  watch(
    () =>
      [
        getActiveSpaceId(),
        codeLayoutMode.value,
        isAvailableToCodePreview.value,
        selectedSnippetContent.value?.language,
        isShowCodePreview.value,
        isShowJsonVisualizer.value,
        Boolean(selectedNote.value),
        isNotesMindmapShown.value,
        isNotesPresentationShown.value,
        notesLayoutMode.value,
        notesEditorMode.value,
      ] as const,
    () => {
      ipc.send(
        'main-menu:update-context',
        createMainMenuContext({
          activeSpaceId: getActiveSpaceId(),
          code: {
            canPreviewCode: isAvailableToCodePreview.value,
            canPreviewJson: selectedSnippetContent.value?.language === 'json',
            isCodePreviewShown: isShowCodePreview.value,
            isJsonPreviewShown: isShowJsonVisualizer.value,
            layoutMode: codeLayoutMode.value,
          },
          notes: {
            hasSelectedNote: Boolean(selectedNote.value),
            isMindmapShown: isNotesMindmapShown.value,
            isPresentationShown: isNotesPresentationShown.value,
            layoutMode: notesLayoutMode.value,
            mode: notesEditorMode.value,
          },
        }),
      )
    },
    { immediate: true },
  )
}
