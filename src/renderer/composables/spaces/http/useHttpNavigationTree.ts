import type {
  DropTarget,
  HttpTreeNode,
  MoveError,
} from '@/components/http/tree/types'
import { buildNavigationNodes } from '@/components/http/tree/liveModel'
import {
  folderOrderWrites,
  planMove,
  selectedRoots,
} from '@/components/http/tree/model'
import { LibraryFilter } from '@/composables/types'
import { useSonner } from '@/composables/useSonner'
import { markPersistedStorageMutation } from '@/composables/useStorageMutation'
import { i18n } from '@/electron'
import { api } from '@/services/api'
import { httpRuntimeNavigation } from './runtimeNavigation'
import { useHttpApp } from './useHttpApp'
import { useHttpFolders } from './useHttpFolders'
import { useHttpRequests } from './useHttpRequests'

export function useHttpNavigationTree() {
  const { httpState } = useHttpApp()
  const {
    folders,
    getHttpFolders,
    selectHttpFolder,
    openHttpFolder,
    clearFolderSelection,
  } = useHttpFolders()
  const {
    allRequests,
    requests,
    getAllHttpRequests,
    getHttpRequests,
    selectHttpRequest,
    currentRequest,
    updateHttpRequest,
  } = useHttpRequests()
  const { sonner } = useSonner()
  const busy = ref(false)
  const loadError = ref(false)
  const nodes = computed(() =>
    buildNavigationNodes(folders.value, [
      ...allRequests.value,
      ...requests.value.filter(request => request.isDeleted),
    ]),
  )

  async function refresh() {
    try {
      await getAllHttpRequests()
      loadError.value = false
    }
    catch {
      loadError.value = true
    }
  }

  let selectionToken = 0
  async function open(node: HttpTreeNode) {
    const token = ++selectionToken
    if (node.entityId === undefined)
      return
    if (node.kind === 'request') {
      await selectHttpRequest(node.entityId)
      if (
        token !== selectionToken
        || (httpState.activePanel !== undefined
          && httpState.activePanel !== 'request')
        || httpState.requestId !== node.entityId
      ) {
        return
      }
      if (!httpState.libraryFilter) {
        const request = currentRequest.value
        if (request?.folderId !== null && request?.folderId !== undefined) {
          await selectHttpFolder(request.folderId)
        }
        else {
          clearFolderSelection()
          httpState.libraryFilter = LibraryFilter.Inbox
        }
        await getHttpRequests()
      }
      return
    }
    await openHttpFolder(node.entityId)
  }

  function validateMove(
    ids: string[],
    target: DropTarget,
  ): MoveError | undefined {
    const selected = selectedRoots(nodes.value, ids)
    if (busy.value || selected.some(node => node.pending))
      return 'unavailable'
    if (
      target.position !== 'inside'
      && (selected.some(node => node.kind === 'request')
        || nodes.value.find(node => node.id === target.id)?.kind === 'request')
    ) {
      return 'sorted'
    }
    const result = planMove(nodes.value, ids, target)
    return result.ok ? undefined : result.error
  }

  async function move(ids: string[], target: DropTarget) {
    const error = validateMove(ids, target)
    if (error) {
      sonner({
        type: 'error',
        message: i18n.t(`spaces.http.tree.errors.${error}`),
      })
      return
    }
    if (
      !(await httpRuntimeNavigation.confirmLeave())
      || validateMove(ids, target)
    ) {
      return
    }
    const result = planMove(nodes.value, ids, target)
    if (!result.ok)
      return
    busy.value = true
    try {
      markPersistedStorageMutation()
      const parentId = result.parentId
        ? (nodes.value.find(node => node.id === result.parentId)?.entityId
          ?? null)
        : null
      for (const node of selectedRoots(nodes.value, ids)) {
        if (node.kind === 'request') {
          const saved = await updateHttpRequest(node.entityId!, {
            folderId: parentId,
          })
          if (!saved)
            throw new Error('Request move failed')
        }
      }
      for (const write of folderOrderWrites(
        nodes.value,
        result.nodes,
        result.parentId,
      )) {
        await api.httpFolders.patchHttpFoldersById(
          String(write.node.entityId),
          { parentId, orderIndex: write.orderIndex },
        )
      }
      if (parentId !== null) {
        await api.httpFolders.patchHttpFoldersById(String(parentId), {
          isOpen: 1,
        })
      }
      if (
        (httpState.activePanel === undefined
          || httpState.activePanel === 'request')
        && currentRequest.value?.folderId != null
        && !httpState.libraryFilter
      ) {
        httpState.folderId = currentRequest.value.folderId
      }
    }
    catch {
      sonner({ type: 'error', message: i18n.t('spaces.http.tree.moveFailed') })
    }
    finally {
      await Promise.allSettled([
        getHttpFolders(false),
        getHttpRequests(),
        refresh(),
      ])
      busy.value = false
    }
  }

  return { nodes, open, move, validateMove, refresh, loadError, busy }
}
