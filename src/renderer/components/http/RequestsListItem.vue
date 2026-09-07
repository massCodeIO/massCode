<script setup lang="ts">
import type { HttpRequestListItem } from '@/composables/spaces/http/useHttpRequests'
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import { useHttpApp, useHttpRequests } from '@/composables'
import { i18n } from '@/electron'
import { onClickOutside } from '@vueuse/core'
import { format } from 'date-fns'
import { CloudDownload } from 'lucide-vue-next'

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
const { selectHttpRequest, selectedRequestIds } = useHttpRequests()
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
// Содержимое ещё в облаке: мутации (запись файла) и копирование превью
// недоступны до докачки; чтение метаданных и ссылки работают.
const isCloudPending = computed(
  () => props.request.pendingCloudDownload === true,
)

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
              :protocol="props.request.protocol"
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
      <HttpRequestContextMenu :request="request" />
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
