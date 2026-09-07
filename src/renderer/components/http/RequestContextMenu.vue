<script setup lang="ts">
import type { HttpRequestListItem } from '@/composables/spaces/http/useHttpRequests'
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import {
  useDonations,
  useHttpApp,
  useHttpEnvironments,
  useHttpFolders,
  useHttpRequests,
  useSonner,
} from '@/composables'
import { flattenFolderTree } from '@/composables/spaces/http/useHttpFolderTree'
import { LibraryFilter } from '@/composables/types'
import { i18n, ipc } from '@/electron'
import { isMac } from '@/utils'
import { useClipboard } from '@vueuse/core'
import { api } from '~/renderer/services/api'
import {
  findHttpCollection,
  readHttpCollection,
} from '~/shared/httpCollection'
import { buildHttpPreview } from './requestPreview'

interface Props {
  request: HttpRequestListItem
}

const props = defineProps<Props>()

const { highlightedRequestIds, focusedRequestId, httpState } = useHttpApp()
const {
  deleteSelectedHttpRequests,
  duplicateHttpRequest,
  selectFirstRequest,
  selectHttpRequest,
  selectedRequestIds,
  selectedRequests,
  updateHttpRequest,
  updateHttpRequests,
} = useHttpRequests()
const { activeEnvironmentVariables } = useHttpEnvironments()
const { folders } = useHttpFolders()
const { copy } = useClipboard()

const isDuplicateDisabled = computed(() => selectedRequestIds.value.length > 1)
const isFavoritesLibrarySelected = computed(
  () => httpState.libraryFilter === LibraryFilter.Favorites,
)
const isTrashLibrarySelected = computed(
  () => httpState.libraryFilter === LibraryFilter.Trash,
)
const isRemoveFavoritesAction = computed(() => {
  if (isFavoritesLibrarySelected.value)
    return true

  if (selectedRequestIds.value.includes(props.request.id)) {
    return selectedRequests.value.every(request => request.isFavorites)
  }

  return Boolean(props.request.isFavorites)
})
const revealInFileManagerLabel = computed(() =>
  isMac
    ? i18n.t('action.reveal.inFinder')
    : i18n.t('action.reveal.inFileManager'),
)

// Содержимое ещё в облаке: мутации (запись файла) и копирование превью
// недоступны до докачки; чтение метаданных и ссылки работают.
const isCloudPending = computed(
  () => props.request.pendingCloudDownload === true,
)

const previewVariables = activeEnvironmentVariables

function getActionTargetIds() {
  const highlightedIds = [...highlightedRequestIds.value]

  if (
    highlightedRequestIds.value.has(props.request.id)
    && highlightedIds.length > 1
  ) {
    return highlightedIds
  }

  if (selectedRequestIds.value.includes(props.request.id)) {
    return [...selectedRequestIds.value]
  }

  return [props.request.id]
}

async function onDelete() {
  await deleteSelectedHttpRequests(props.request)
}

async function onAddFavorites() {
  const isFavorites = isRemoveFavoritesAction.value ? 0 : 1
  const targetIds = getActionTargetIds()

  if (targetIds.length > 1) {
    const requestsData = targetIds.map(() => ({ isFavorites }))
    await updateHttpRequests(targetIds, requestsData)
  }
  else {
    await updateHttpRequest(props.request.id, { isFavorites })
  }

  if (
    isFavoritesLibrarySelected.value
    && (targetIds.length > 1 || httpState.requestId === props.request.id)
  ) {
    selectFirstRequest()
  }
}

async function onRestore() {
  const targetIds = getActionTargetIds()

  if (targetIds.length > 1) {
    const requestsData = targetIds.map(() => ({
      folderId: null,
      isDeleted: 0,
    }))
    await updateHttpRequests(targetIds, requestsData)
    selectFirstRequest()
  }
  else {
    await updateHttpRequest(props.request.id, {
      folderId: null,
      isDeleted: 0,
    })
    if (httpState.requestId === props.request.id) {
      selectFirstRequest()
    }
  }
}

async function onDuplicate() {
  const id = await duplicateHttpRequest(props.request.id)
  if (id) {
    await selectHttpRequest(id)
    focusedRequestId.value = id
  }
}

function onRevealInFileManager() {
  void ipc.invoke('system:show-http-request-in-file-manager', props.request.id)
}

async function onCopyRequest() {
  try {
    // Список не содержит body/description: полная запись загружается по id.
    const { data } = await api.httpRequests.getHttpRequestsById(
      String(props.request.id),
    )

    // Свежий флаг из ответа: файл мог выгрузиться после скана, и preview
    // скопировался бы без body.
    if (data.pendingCloudDownload) {
      useSonner().sonner({
        id: 'cloud-file-not-ready',
        message: i18n.t('messages:warning.cloudFileNotReady'),
        type: 'warning',
      })
      return
    }

    copy(
      buildHttpPreview(data, {
        variables: previewVariables.value,
        collection: readHttpCollection(
          findHttpCollection(flattenFolderTree(folders.value), data.folderId),
        ),
      }),
    )
    useDonations().incrementCopy('http')
  }
  catch (error) {
    console.error(error)
  }
}

function onCopyRequestLink() {
  copy(`masscode://goto?httpRequestId=${props.request.id}`)
}
</script>

<template>
  <ContextMenu.ContextMenuContent>
    <slot />
    <template v-if="!isTrashLibrarySelected">
      <ContextMenu.ContextMenuItem
        :disabled="isCloudPending"
        @click="onAddFavorites"
      >
        {{
          isRemoveFavoritesAction
            ? i18n.t("action.remove.fromFavorites")
            : i18n.t("action.add.toFavorites")
        }}
      </ContextMenu.ContextMenuItem>
      <ContextMenu.ContextMenuSeparator />
    </template>
    <ContextMenu.ContextMenuItem @click="onRevealInFileManager">
      {{ revealInFileManagerLabel }}
    </ContextMenu.ContextMenuItem>
    <ContextMenu.ContextMenuItem
      :disabled="isCloudPending"
      @click="onCopyRequest"
    >
      {{ i18n.t("action.copy.request") }}
    </ContextMenu.ContextMenuItem>
    <ContextMenu.ContextMenuItem @click="onCopyRequestLink">
      {{ i18n.t("action.copy.requestLink") }}
    </ContextMenu.ContextMenuItem>
    <ContextMenu.ContextMenuSeparator />
    <ContextMenu.ContextMenuItem
      :disabled="isDuplicateDisabled || isCloudPending"
      @click="onDuplicate"
    >
      {{ i18n.t("action.duplicate") }}
    </ContextMenu.ContextMenuItem>
    <ContextMenu.ContextMenuSeparator />
    <ContextMenu.ContextMenuItem
      :disabled="isCloudPending"
      @click="onDelete"
    >
      {{
        isTrashLibrarySelected
          ? i18n.t("action.delete.common")
          : i18n.t("action.move.toTrash")
      }}
    </ContextMenu.ContextMenuItem>
    <ContextMenu.ContextMenuItem
      v-if="isTrashLibrarySelected"
      :disabled="isCloudPending"
      @click="onRestore"
    >
      {{ i18n.t("action.restore") }}
    </ContextMenu.ContextMenuItem>
  </ContextMenu.ContextMenuContent>
</template>
