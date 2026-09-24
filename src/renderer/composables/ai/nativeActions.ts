import type { NativeBridgeResult } from './nativeBridges'
import type { AiContext } from './useAi'
import type { HttpAiSnapshot } from './useHttpAi'
import type {
  AiNativeAction,
  AiNativeState,
  AiNativeTarget,
} from '~/shared/aiNativeActions'
import { useHttpApp } from '@/composables/spaces/http/useHttpApp'
import { useHttpRequests } from '@/composables/spaces/http/useHttpRequests'
import { useNotes } from '@/composables/spaces/notes/useNotes'
import { useNotesApp } from '@/composables/spaces/notes/useNotesApp'
import { useApp } from '@/composables/useApp'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { useNavigationHistory } from '@/composables/useNavigationHistory'
import { useSnippets } from '@/composables/useSnippets'
import { ipc, store } from '@/electron'
import {
  navigateBack,
  navigateForward,
  openInternalTarget,
  openSpaceTarget,
} from '@/ipc/listeners/deepLinks'
import { router, RouterName } from '@/router'
import { runNativeBridge } from './nativeBridges'

export function readNativeState(): AiNativeState {
  const { canGoBack, canGoForward } = useNavigationHistory()
  const state: AiNativeState = {
    selectedIds: [],
    canGoBack: canGoBack.value,
    canGoForward: canGoForward.value,
  }
  const route = router.currentRoute.value.name
  if (route === RouterName.main) {
    const { selectedSnippet, selectedSnippetContent, selectedSnippetIds }
      = useSnippets()
    const { isShowCodeImage, isShowJsonVisualizer, isShowCodePreview }
      = useApp()
    state.space = 'code'
    state.selectedIds = [...selectedSnippetIds.value].slice(0, 1000)
    if (selectedSnippet.value) {
      state.target = {
        space: 'code',
        id: selectedSnippet.value.id,
        contentId: selectedSnippetContent.value?.id,
      }
    }
    state.view = isShowCodeImage.value
      ? 'codeImage'
      : isShowJsonVisualizer.value
        ? 'jsonVisualizer'
        : isShowCodePreview.value
          ? 'codePreview'
          : 'editor'
  }
  else if (
    route === RouterName.notesDashboard
    || route === RouterName.notesGraph
  ) {
    state.space = 'notes'
    state.view = route === RouterName.notesDashboard ? 'dashboard' : 'graph'
  }
  else if (
    route === RouterName.notesSpace
    || route === RouterName.notesPresentation
  ) {
    const { selectedNote, selectedNoteIds } = useNotes()
    const { notesEditorMode, isNotesMindmapShown } = useNotesApp()
    state.space = 'notes'
    state.selectedIds = [...selectedNoteIds.value].slice(0, 1000)
    if (selectedNote.value)
      state.target = { space: 'notes', id: selectedNote.value.id }
    state.view
      = route === RouterName.notesPresentation
        ? 'presentation'
        : isNotesMindmapShown.value
          ? 'mindmap'
          : notesEditorMode.value
  }
  else if (route === RouterName.httpSpace) {
    const { currentRequest, selectedRequestIds } = useHttpRequests()
    state.space = 'http'
    state.selectedIds = [...selectedRequestIds.value].slice(0, 1000)
    if (currentRequest.value)
      state.target = { space: 'http', id: currentRequest.value.id }
    state.view = useHttpApp().httpState.activePanel ?? 'request'
  }
  return state
}
export function matchesNativeTarget(
  target: AiNativeTarget,
  state = readNativeState(),
) {
  return (
    state.target?.space === target.space
    && state.target.id === target.id
    && (target.space !== 'code'
      || target.contentId === undefined
      || (state.target.space === 'code'
        && state.target.contentId === target.contentId))
  )
}

export async function executeNativeAction(
  operation: AiNativeAction,
  current: () => boolean,
  editor: () => AiContext | undefined,
  actionId?: string,
  httpSnapshot?: () => HttpAiSnapshot | undefined,
): Promise<NativeBridgeResult> {
  if (!current())
    return { status: 'stale' }
  try {
    if (operation.action === 'reload')
      return { status: 'done', reloadRequested: true }
    if (operation.action === 'themeAction') {
      await ipc.invoke(
        operation.command === 'openDirectory'
          ? 'theme:open-dir'
          : 'theme:create-template',
        null,
      )
      return {
        status: 'done',
        persisted: operation.command === 'createTemplate',
      }
    }
    if (operation.action === 'cleanupCompletedTasks') {
      const vault = store.preferences.get<string>('storage.vaultPath') ?? ''
      const { receiptId, ...result } = await useNotes().cleanupCompletedTasks({
        current,
        captureUndo: true,
      })
      return {
        ...result,
        ...(receiptId
          ? {
              mutation: { kind: 'tasksCleanup', id: receiptId, vault } as const,
            }
          : {}),
      }
    }
    if (operation.action === 'reveal') {
      const channel
        = operation.target.space === 'code'
          ? 'system:show-snippet-in-file-manager'
          : operation.target.space === 'notes'
            ? 'system:show-note-in-file-manager'
            : 'system:show-http-request-in-file-manager'
      const shown = await ipc.invoke(channel, operation.target.id)
      return {
        status: shown ? 'done' : 'unavailable',
        target: operation.target,
      }
    }
    if (
      operation.action === 'folderIcon'
      || operation.action === 'readFolderIcons'
    ) {
      const { executeFolderIconAction } = await import('./nativeFolderIcons')
      return executeFolderIconAction(operation, current)
    }
    if (operation.action === 'storage' || operation.action === 'configureAi') {
      if (!actionId)
        return { status: 'unavailable' }
      const { executePreferenceFlow } = await import('./nativePreferenceFlows')
      return executePreferenceFlow(operation, actionId, current)
    }
    if (operation.action === 'readDrawings') {
      const { readNativeDrawings } = await import('./nativeNoteImage')
      return readNativeDrawings(operation, current)
    }
    if (
      operation.action === 'readPreferences'
      || operation.action === 'setPreferences'
    ) {
      const preferences = await import('./nativePreferences')
      return operation.action === 'readPreferences'
        ? await preferences.readNativePreferences()
        : await preferences.setNativePreferences(operation.change, current)
    }
    if (
      operation.action === 'listQuery'
      || operation.action === 'listSelection'
    ) {
      const { executeNativeList } = await import('./nativeList')
      return executeNativeList(operation, current)
    }
    if (
      operation.action === 'httpOverview'
      || operation.action === 'httpRunner'
    ) {
      const { executeNativeHttpWorkspace } = await import(
        './nativeHttpWorkspace'
      )
      return executeNativeHttpWorkspace(operation, current)
    }
    if (
      operation.action === 'readNotesDashboard'
      || operation.action === 'notesPage'
      || operation.action === 'notesLibrary'
      || operation.action === 'listView'
      || operation.action === 'notesInspector'
    ) {
      const { executeWorkspaceView } = await import('./nativeWorkspaceViews')
      return executeWorkspaceView(operation, current)
    }
    if (operation.action === 'openSpace') {
      await openSpaceTarget(operation.space)
      const state = readNativeState()
      return {
        status: !current()
          ? 'stale'
          : state.space === operation.space
            ? 'done'
            : 'cancelled',
        state,
      }
    }
    if (operation.action === 'history') {
      const { cursor } = useNavigationHistory()
      const before = cursor.value
      await (operation.direction === 'back'
        ? navigateBack()
        : navigateForward())
      return {
        status: !current()
          ? 'stale'
          : before !== cursor.value
            ? 'done'
            : 'unavailable',
        state: readNativeState(),
      }
    }
    if (operation.action === 'navigate') {
      const target = operation.target
      if (!matchesNativeTarget(target)) {
        await openInternalTarget({
          type:
            target.space === 'code'
              ? 'snippet'
              : target.space === 'notes'
                ? 'note'
                : 'http-request',
          id: target.id,
        })
        if (!current())
          return { status: 'stale' }
        if (target.space === 'code') {
          const snippets = useSnippets()
          if (snippets.selectedSnippetRecordStatus.value !== 'ready')
            await snippets.refreshSelectedSnippet()
          if (
            target.contentId !== undefined
            && snippets.selectedSnippet.value?.id === target.id
          ) {
            const index = snippets.selectedSnippet.value.contents.findIndex(
              content => content.id === target.contentId,
            )
            if (index < 0)
              return { status: 'unavailable' }
            useApp().state.snippetContentIndex = index
          }
        }
        else if (
          target.space === 'notes'
          && useNotes().selectedNoteRecordStatus.value !== 'ready'
        ) {
          await useNotes().refreshSelectedNote()
        }
        await nextTick()
      }
      return {
        status: !current()
          ? 'stale'
          : matchesNativeTarget(target)
            ? 'done'
            : 'cancelled',
        state: readNativeState(),
      }
    }
    if (operation.action === 'notesGraph') {
      return runNativeBridge(
        operation,
        () =>
          current() && router.currentRoute.value.name === RouterName.notesGraph,
      )
    }
    if (!matchesNativeTarget(operation.target))
      return { status: 'stale' }
    const stillCurrent = () =>
      current() && matchesNativeTarget(operation.target)
    if (operation.action === 'openDrawingEmbed') {
      const { openNativeDrawingEmbed } = await import('./nativeNoteImage')
      return openNativeDrawingEmbed(operation, current, editor)
    }
    if (operation.action === 'presentation')
      return runNativeBridge(operation, current)
    if (
      operation.action === 'insertNoteImage'
      || operation.action === 'insertDrawing'
    ) {
      const { insertNativeNoteImage } = await import('./nativeNoteImage')
      return insertNativeNoteImage(operation, stillCurrent, editor)
    }
    if (
      operation.action === 'chooseHttpFile'
      || operation.action === 'enterHttpSecret'
    ) {
      const { executeHttpHandoff } = await import('./nativeHttpHandoffs')
      return executeHttpHandoff(operation, stillCurrent, httpSnapshot)
    }
    if (operation.action === 'httpDock') {
      const { useHttpUi } = await import('@/composables/spaces/http/useHttpUi')
      const ui = useHttpUi()
      if (!ui.dockOpen.value)
        return { status: 'unavailable' }
      ui.dockMaximized.value = operation.maximized
      await nextTick()
      return {
        status: !stillCurrent()
          ? 'stale'
          : ui.dockOpen.value && ui.dockMaximized.value === operation.maximized
            ? 'done'
            : 'unavailable',
        panel: 'dock',
      }
    }
    if (operation.action === 'httpDevtools') {
      const { executeHttpDevtools } = await import('./nativeHttpDevtools')
      return executeHttpDevtools(operation, stillCurrent)
    }
    if (operation.action === 'httpPanel' || operation.action === 'httpView') {
      const { setNativeHttpPanel } = await import('./nativeHttpPanels')
      return setNativeHttpPanel(operation, stillCurrent)
    }
    if (operation.action === 'copy') {
      const target = operation.target
      let value: string | undefined
      if (operation.part === 'link') {
        value = `masscode://goto?${target.space === 'code' ? 'snippetId' : target.space === 'notes' ? 'noteId' : 'httpRequestId'}=${target.id}`
      }
      else if (operation.part === 'title') {
        value
          = target.space === 'code'
            ? useSnippets().selectedSnippet.value?.name
            : target.space === 'notes'
              ? useNotes().selectedNote.value?.name
              : useHttpRequests().currentRequest.value?.name
      }
      else if (operation.part === 'url' && target.space === 'http') {
        value = useHttpRequests().currentDraft.value?.url
      }
      else if (operation.part === 'content' && target.space !== 'http') {
        const snapshot = editor()
        if (
          snapshot?.space === target.space
          && (snapshot.space === 'code' ? snapshot.snippetId : snapshot.noteId)
          === target.id
        ) {
          value = snapshot.text
        }
      }
      if (value === undefined)
        return { status: 'unavailable' }
      const copied = await useCopyToClipboard()(value)
      // Clipboard write is complete even if navigation changed while awaiting it.
      return {
        status: copied ? 'done' : 'failed',
        characters: copied ? value.length : undefined,
        target,
      }
    }
    if (operation.action === 'setView') {
      if (operation.target.space === 'code') {
        if (
          !['editor', 'codeImage', 'jsonVisualizer', 'codePreview'].includes(
            operation.view,
          )
        ) {
          return { status: 'unavailable' }
        }
        const snippets = useSnippets()
        if (
          operation.view === 'codePreview'
          && !snippets.isAvailableToCodePreview.value
        ) {
          return { status: 'unavailable' }
        }
        if (
          operation.view === 'jsonVisualizer'
          && snippets.selectedSnippetContent.value?.language !== 'json'
        ) {
          return { status: 'unavailable' }
        }
        const app = useApp()
        app.isShowCodeImage.value = operation.view === 'codeImage'
        app.isShowJsonVisualizer.value = operation.view === 'jsonVisualizer'
        app.isShowCodePreview.value = operation.view === 'codePreview'
      }
      else if (operation.target.space === 'notes') {
        const app = useNotesApp()
        if (operation.view === 'mindmap') {
          app.showNotesMindmap()
        }
        else if (operation.view === 'presentation') {
          app.showNotesPresentation()
        }
        else if (
          ['raw', 'livePreview', 'preview', 'editor'].includes(operation.view)
        ) {
          app.hideNotesViewModes()
          app.notesEditorMode.value
            = operation.view === 'editor'
              ? 'livePreview'
              : (operation.view as 'raw' | 'livePreview' | 'preview')
        }
        else {
          return { status: 'unavailable' }
        }
        await router.push({
          name:
            operation.view === 'presentation'
              ? RouterName.notesPresentation
              : RouterName.notesSpace,
        })
      }
      else {
        return { status: 'unavailable' }
      }
      await nextTick()
      return {
        status: stillCurrent() ? 'done' : 'stale',
        state: readNativeState(),
      }
    }
    return await runNativeBridge(operation, stillCurrent)
  }
  catch {
    return { status: 'failed' }
  }
}
