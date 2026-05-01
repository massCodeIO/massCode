<script setup lang="ts">
import type { HttpRequestListItem } from '@/composables/spaces/http/useHttpRequests'
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import { useDialog, useHttpApp, useHttpRequests } from '@/composables'
import { i18n } from '@/electron'
import { onClickOutside } from '@vueuse/core'
import { format } from 'date-fns'

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
  deleteHttpRequest,
  selectFirstRequest,
  selectHttpRequest,
  selectedRequestIds,
} = useHttpRequests()

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
  const { confirm } = useDialog()
  const targetIds = selectedRequestIds.value.includes(props.request.id)
    ? [...selectedRequestIds.value]
    : [props.request.id]

  const isConfirmed = await confirm({
    title:
      targetIds.length > 1
        ? i18n.t('messages:confirm.deleteConfirmMultipleSnippets', {
            count: targetIds.length,
          })
        : i18n.t('messages:confirm.delete', { name: props.request.name }),
    content: i18n.t('messages:warning.noUndo'),
  })

  if (!isConfirmed)
    return

  const wasCurrentSelected = targetIds.includes(httpState.requestId ?? -1)

  for (const id of targetIds) {
    await deleteHttpRequest(id)
  }

  if (wasCurrentSelected) {
    selectFirstRequest()
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
    draggable="true"
    @click="onClick"
    @contextmenu="onClickContextMenu"
    @dragstart.stop="onDragStart"
  >
    <ContextMenu.ContextMenu>
      <ContextMenu.ContextMenuTrigger>
        <div class="flex flex-col gap-1 px-2 py-2 select-none">
          <div class="flex items-baseline gap-2">
            <HttpMethodBadge
              :method="props.request.method"
              size="sm"
              class="shrink-0"
            />
            <UiText class="flex-1 truncate text-sm">
              {{ props.request.name }}
            </UiText>
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
              >(no url)</span>
            </span>
            <span class="shrink-0 tabular-nums">
              {{ format(new Date(props.request.updatedAt), "dd.MM.yyyy") }}
            </span>
          </UiText>
        </div>
      </ContextMenu.ContextMenuTrigger>
      <ContextMenu.ContextMenuContent>
        <ContextMenu.ContextMenuItem @click="onDelete">
          {{ i18n.t("action.delete.common") }}
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
    .meta {
      @apply text-accent-foreground;
    }
  }
  &.is-multi-selected {
    @apply bg-accent text-accent-foreground z-10 rounded-md border-transparent;
    .meta {
      @apply text-accent-foreground;
    }
  }
  &.is-focused:not(.is-multi-selected) {
    @apply bg-primary text-primary-foreground z-10 rounded-md border-transparent;
    .meta {
      @apply text-primary-foreground;
    }
  }
  &.is-highlighted {
    @apply outline-primary rounded-md outline-2 -outline-offset-2;
    &.is-focused,
    &.is-selected,
    &.is-multi-selected {
      @apply bg-background text-accent-foreground;
      .meta {
        @apply text-accent-foreground;
      }
    }
  }
}
</style>
