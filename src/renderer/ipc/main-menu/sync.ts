import {
  useApp,
  useContentSort,
  useHttpApp,
  useHttpExecute,
  useHttpRequests,
  useNotes,
  useNotesApp,
  useSnippets,
} from '@/composables'
import { useHttpPanels } from '@/composables/spaces/http/useHttpPanels'
import { ipc } from '@/electron'
import { getActiveSpaceId } from '@/spaceDefinitions'
import { getCodeFormatterParser } from '~/shared/codeFormatter'
import { createMainMenuContext } from './context'

const {
  state,
  codeLayoutMode,
  isCompactListMode,
  isShowCodePreview,
  isShowJsonVisualizer,
} = useApp()
const { selectedNote } = useNotes()
const {
  isNotesInspectorOpen,
  isNotesMindmapShown,
  isNotesPresentationShown,
  notesEditorMode,
  notesLayoutMode,
  hideCompletedTasksInFolders,
} = useNotesApp()
const { bottomOpen, inspectorOpen } = useHttpPanels()
const { httpLayoutMode, httpState } = useHttpApp()
const { isExecuting } = useHttpExecute()
const { currentDraft, currentRequest, isCurrentRequestLoading }
  = useHttpRequests()
const {
  isAvailableToCodePreview,
  selectedSnippetContent,
  selectedSnippet,
  selectedSnippetIds,
  selectedSnippetRecordStatus,
} = useSnippets()
const { contentSortState } = useContentSort()

export function registerMainMenuContextSync() {
  watch(
    () =>
      [
        getActiveSpaceId(),
        codeLayoutMode.value,
        isCompactListMode.value,
        isAvailableToCodePreview.value,
        selectedSnippetContent.value?.language,
        selectedSnippetContent.value?.value !== undefined,
        selectedSnippetRecordStatus.value,
        selectedSnippet.value?.id,
        selectedSnippetIds.value.length,
        state.snippetId,
        isShowCodePreview.value,
        isShowJsonVisualizer.value,
        Boolean(selectedNote.value),
        isNotesInspectorOpen.value,
        isNotesMindmapShown.value,
        isNotesPresentationShown.value,
        notesLayoutMode.value,
        notesEditorMode.value,
        hideCompletedTasksInFolders.value,
        httpLayoutMode.value,
        bottomOpen.value,
        inspectorOpen.value,
        contentSortState.code.sort,
        contentSortState.code.order,
        contentSortState.notes.sort,
        contentSortState.notes.order,
        contentSortState.http.sort,
        contentSortState.http.order,
        contentSortState.math.sort,
        contentSortState.math.order,
        contentSortState.drawings.sort,
        contentSortState.drawings.order,
        currentDraft.value?.url,
        isExecuting.value,
        currentRequest.value?.pendingCloudDownload,
        currentRequest.value?.id,
        httpState.requestId,
        httpState.activePanel,
        isCurrentRequestLoading.value,
      ] as const,
    () => {
      ipc.send(
        'main-menu:update-context',
        createMainMenuContext({
          activeSpaceId: getActiveSpaceId(),
          compactListMode: isCompactListMode.value,
          hideCompletedTasksInFolders: hideCompletedTasksInFolders.value,
          contentSort: {
            code: { ...contentSortState.code },
            notes: { ...contentSortState.notes },
            http: { ...contentSortState.http },
            math: { ...contentSortState.math },
            drawings: { ...contentSortState.drawings },
          },
          code: {
            canFormat:
              selectedSnippetRecordStatus.value === 'ready'
              && selectedSnippetIds.value.length === 1
              && selectedSnippet.value?.id === state.snippetId
              && selectedSnippetContent.value?.value !== undefined
              && !!getCodeFormatterParser(selectedSnippetContent.value.language),
            canPreviewCode: isAvailableToCodePreview.value,
            canPreviewJson: selectedSnippetContent.value?.language === 'json',
            isCodePreviewShown: isShowCodePreview.value,
            isJsonPreviewShown: isShowJsonVisualizer.value,
            layoutMode: codeLayoutMode.value,
          },
          notes: {
            inspectorOpen: isNotesInspectorOpen.value,
            hasSelectedNote: Boolean(selectedNote.value),
            isMindmapShown: isNotesMindmapShown.value,
            isPresentationShown: isNotesPresentationShown.value,
            layoutMode: notesLayoutMode.value,
            mode: notesEditorMode.value,
          },
          http: {
            layoutMode: httpLayoutMode.value,
            panels: {
              sidebar: httpLayoutMode.value !== 'editor-only',
              bottom: bottomOpen.value,
              inspector: inspectorOpen.value,
              canToggleBottom:
                !httpState.activePanel || httpState.activePanel === 'request',
            },
            canSendRequest:
              (httpState.activePanel === undefined
                || httpState.activePanel === 'request')
              && Boolean(currentDraft.value?.url)
              && !isExecuting.value
              && !currentRequest.value?.pendingCloudDownload
              // Полная запись выбранного запроса ещё грузится: draft пока
              // принадлежит предыдущему, отправился бы не тот запрос.
              && !isCurrentRequestLoading.value
              && httpState.requestId === currentRequest.value?.id,
          },
        }),
      )
    },
    { immediate: true },
  )
}
