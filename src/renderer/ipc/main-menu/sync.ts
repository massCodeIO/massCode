import {
  useApp,
  useHttpApp,
  useHttpExecute,
  useHttpRequests,
  useNotes,
  useNotesApp,
  useSnippets,
} from '@/composables'
import { ipc } from '@/electron'
import { getActiveSpaceId } from '@/spaceDefinitions'
import { createMainMenuContext } from './context'

const {
  codeLayoutMode,
  isCompactListMode,
  isShowCodePreview,
  isShowJsonVisualizer,
} = useApp()
const { selectedNote } = useNotes()
const {
  isNotesMindmapShown,
  isNotesPresentationShown,
  notesEditorMode,
  notesLayoutMode,
} = useNotesApp()
const { httpLayoutMode } = useHttpApp()
const { isExecuting } = useHttpExecute()
const { currentDraft } = useHttpRequests()
const { isAvailableToCodePreview, selectedSnippetContent } = useSnippets()

export function registerMainMenuContextSync() {
  watch(
    () =>
      [
        getActiveSpaceId(),
        codeLayoutMode.value,
        isCompactListMode.value,
        isAvailableToCodePreview.value,
        selectedSnippetContent.value?.language,
        isShowCodePreview.value,
        isShowJsonVisualizer.value,
        Boolean(selectedNote.value),
        isNotesMindmapShown.value,
        isNotesPresentationShown.value,
        notesLayoutMode.value,
        notesEditorMode.value,
        httpLayoutMode.value,
        currentDraft.value?.url,
        isExecuting.value,
      ] as const,
    () => {
      ipc.send(
        'main-menu:update-context',
        createMainMenuContext({
          activeSpaceId: getActiveSpaceId(),
          compactListMode: isCompactListMode.value,
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
          http: {
            layoutMode: httpLayoutMode.value,
            canSendRequest:
              Boolean(currentDraft.value?.url) && !isExecuting.value,
          },
        }),
      )
    },
    { immediate: true },
  )
}
