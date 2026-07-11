<script setup lang="ts">
import type { HttpRequestListItem } from '@/composables/spaces/http/useHttpRequests'
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import {
  useDonations,
  useHttpApp,
  useHttpEnvironments,
  useHttpRequests,
  useSonner,
} from '@/composables'
import { LibraryFilter } from '@/composables/types'
import { i18n, ipc } from '@/electron'
import { isMac } from '@/utils'
import { onClickOutside, useClipboard } from '@vueuse/core'
import { format } from 'date-fns'
import { CloudDownload } from 'lucide-vue-next'
import { api } from '~/renderer/services/api'
import { buildHttpPreview } from './requestPreview'

interface Props {
  request: HttpRequestListItem
}

const props = defineProps<Props>()

const {
  highlightedRequestIds,
  highlightedFolderIds,
  focusedRequestId,
  httpState,
} = useHttpApp()
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
const { activeEnvironment } = useHttpEnvironments()
const { copy } = useClipboard()

const itemRef = ref<HTMLDivElement>()

const isSelected = computed(() => httpState.requestId === props.request.id)
const isInMultiSelection = computed(
  () =>
    selectedRequestIds.value.length > 1
    && selectedRequestIds.value.includes(props.request.id),
)
const isHighlighted = computed(() =>
  highlightedRequestIds.value.has(props.request.id),
)
const isFocused = computed(() => focusedRequestId.value === props.request.id)
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

const previewVariables = computed<Record<string, string>>(() => {
  return (activeEnvironment.value?.variables as Record<string, string>) ?? {}
})

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

function onClick(event: MouseEvent) {
  selectHttpRequest(props.request.id, event.shiftKey)
  focusedRequestId.value = props.request.id
}

function onClickContextMenu() {
  highlightedFolderIds.value.clear()
  highlightedRequestIds.value.clear()
  highlightedRequestIds.value.add(props.request.id)

  if (selectedRequestIds.value.length > 1) {
    selectedRequestIds.value.forEach(id =>
      highlightedRequestIds.value.add(id),
    )
  }
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

    copy(buildHttpPreview(data, { variables: previewVariables.value }))
    useDonations().incrementCopy('http')
  }
  catch (error) {
    console.error(error)
  }
}

function onCopyRequestLink() {
  copy(`masscode://goto?httpRequestId=${props.request.id}`)
}

function onDragStart(event: DragEvent) {
  const ids
    = selectedRequestIds.value.length > 1
      ? selectedRequestIds.value
      : [props.request.id]

  event.dataTransfer?.setData('requestIds', JSON.stringify(ids))

  const el = document.createElement('div')

  if (selectedRequestIds.value.length > 1) {
    el.className
      = 'fixed left-[-100%] text-foreground truncate max-w-[200px] flex items-center'
    el.id = 'ghost'
    el.innerHTML = `
      <span class="rounded-full bg-primary text-white px-2 py-0.5 text-xs ml-3">
        ${selectedRequestIds.value.length}
      </span>
    `
  }
  else {
    el.className = 'fixed left-[-100%] text-foreground truncate max-w-[200px]'
    el.id = 'ghost'
    el.innerHTML = props.request.name
  }

  document.body.appendChild(el)
  event.dataTransfer?.setDragImage(el, 0, 0)
  setTimeout(() => el.remove(), 0)
}

onClickOutside(itemRef, () => {
  focusedRequestId.value = undefined
  highlightedRequestIds.value.clear()
})
</script>

<template>
  <div
    ref="itemRef"
    data-http-request-item
    class="border-border relative border-b px-1 focus-visible:outline-none"
    :class="{
      'is-selected': isSelected,
      'is-multi-selected': isInMultiSelection,
      'is-focused': isFocused,
      'is-highlighted': isHighlighted,
    }"
    :draggable="!isCloudPending"
    @click="onClick"
    @contextmenu="onClickContextMenu"
    @dragstart.stop="onDragStart"
  >
    <ContextMenu.ContextMenu>
      <ContextMenu.ContextMenuTrigger>
        <div class="flex flex-col p-2 select-none">
          <div class="mb-2 flex items-baseline gap-2">
            <HttpMethodBadge
              :method="props.request.method"
              size="sm"
              class="method-badge shrink-0"
            />
            <UiText class="title flex-1 truncate text-sm">
              {{ props.request.name }}
            </UiText>
            <CloudDownload
              v-if="isCloudPending"
              class="text-muted-foreground h-3.5 w-3.5 shrink-0 self-center"
              :aria-label="i18n.t('cloudDownloads.label')"
            />
          </div>
          <UiText
            as="div"
            variant="xs"
            muted
            class="meta flex items-center justify-between gap-2"
          >
            <span class="flex-1 truncate font-mono">
              <template v-if="props.request.url">
                {{ props.request.url }}
              </template>
              <span
                v-else
                class="opacity-60"
              >
                {{ i18n.t("spaces.http.noUrl") }}
              </span>
            </span>
            <span class="shrink-0 tabular-nums">
              {{ format(new Date(props.request.updatedAt), "dd.MM.yyyy") }}
            </span>
          </UiText>
        </div>
      </ContextMenu.ContextMenuTrigger>
      <ContextMenu.ContextMenuContent>
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
    </ContextMenu.ContextMenu>
  </div>
</template>

<style lang="scss">
@reference "../../styles.css";
[data-http-request-item] {
  &:not(.is-selected):not(.is-focused):not(.is-multi-selected) {
    @apply hover:bg-accent-hover hover:rounded-md;
  }
  &.is-selected {
    @apply bg-accent text-accent-foreground z-10 rounded-md border-transparent;
    .title {
      @apply text-accent-foreground;
    }
    .meta {
      @apply text-accent-foreground;
    }
    .method-badge[data-method="GET"] {
      @apply text-emerald-700 dark:text-emerald-300;
    }
    .method-badge[data-method="POST"] {
      @apply text-amber-700 dark:text-amber-300;
    }
    .method-badge[data-method="PUT"] {
      @apply text-blue-700 dark:text-blue-300;
    }
    .method-badge[data-method="PATCH"] {
      @apply text-violet-700 dark:text-violet-300;
    }
    .method-badge[data-method="DELETE"] {
      @apply text-rose-700 dark:text-rose-300;
    }
    .method-badge[data-method="HEAD"] {
      @apply text-cyan-700 dark:text-cyan-300;
    }
    .method-badge[data-method="OPTIONS"] {
      @apply text-zinc-700 dark:text-zinc-300;
    }
  }
  &.is-multi-selected {
    @apply bg-accent text-accent-foreground z-10 rounded-md border-transparent;
    .title {
      @apply text-accent-foreground;
    }
    .meta {
      @apply text-accent-foreground;
    }
    .method-badge[data-method="GET"] {
      @apply text-emerald-700 dark:text-emerald-300;
    }
    .method-badge[data-method="POST"] {
      @apply text-amber-700 dark:text-amber-300;
    }
    .method-badge[data-method="PUT"] {
      @apply text-blue-700 dark:text-blue-300;
    }
    .method-badge[data-method="PATCH"] {
      @apply text-violet-700 dark:text-violet-300;
    }
    .method-badge[data-method="DELETE"] {
      @apply text-rose-700 dark:text-rose-300;
    }
    .method-badge[data-method="HEAD"] {
      @apply text-cyan-700 dark:text-cyan-300;
    }
    .method-badge[data-method="OPTIONS"] {
      @apply text-zinc-700 dark:text-zinc-300;
    }
  }
  &.is-focused:not(.is-multi-selected) {
    @apply bg-primary text-primary-foreground z-10 rounded-md border-transparent;
    .title {
      @apply text-primary-foreground;
    }
    .meta {
      @apply text-primary-foreground;
    }
    .method-badge[data-method="GET"] {
      @apply text-emerald-200;
    }
    .method-badge[data-method="POST"] {
      @apply text-amber-200;
    }
    .method-badge[data-method="PUT"] {
      @apply text-blue-100;
    }
    .method-badge[data-method="PATCH"] {
      @apply text-violet-200;
    }
    .method-badge[data-method="DELETE"] {
      @apply text-rose-200;
    }
    .method-badge[data-method="HEAD"] {
      @apply text-cyan-200;
    }
    .method-badge[data-method="OPTIONS"] {
      @apply text-zinc-100;
    }
  }
  &.is-highlighted {
    @apply outline-primary z-20 rounded-md outline-2 -outline-offset-2;
    &.is-focused,
    &.is-selected,
    &.is-multi-selected {
      @apply bg-background text-accent-foreground;
      .title {
        @apply text-accent-foreground;
      }
      .meta {
        @apply text-accent-foreground;
      }
    }
  }
}
</style>
