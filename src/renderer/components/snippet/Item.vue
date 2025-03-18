<script setup lang="ts">
import type { SnippetsResponse } from '@/services/api/generated'
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import { useApp, useSnippets } from '@/composables'
import { i18n } from '@/electron'
import { onClickOutside } from '@vueuse/core'
import { format } from 'date-fns'

interface Props {
  snippet: SnippetsResponse[0]
}

const props = defineProps<Props>()

const {
  selectedSnippetId,
  highlightedSnippetId,
  selectedSnippetIdBeforeSearch,
  isFocusedSnippetName,
} = useApp()
const {
  selectSnippet,
  isSearch,
  deleteSnippet,
  selectFirstSnippet,
  duplicateSnippet,
} = useSnippets()

const isFocused = ref(false)
const snippetRef = ref<HTMLDivElement>()

const isSelected = computed(() => selectedSnippetId.value === props.snippet.id)
const isHighlighted = computed(
  () => highlightedSnippetId.value === props.snippet.id,
)

function onSnippetClick(id: number) {
  selectSnippet(id)

  if (!isSearch.value) {
    selectedSnippetIdBeforeSearch.value = id
  }

  isFocused.value = true
}

function onClickContextMenu() {
  highlightedSnippetId.value = props.snippet.id
}

async function onDelete() {
  await deleteSnippet(props.snippet.id)

  if (selectedSnippetId.value === props.snippet.id) {
    selectFirstSnippet()
  }
}

async function onDuplicate() {
  await duplicateSnippet(props.snippet.id)
  selectFirstSnippet()
  isFocusedSnippetName.value = true
}

function onDragStart(event: DragEvent) {
  event.dataTransfer?.setData('snippet', props.snippet.id.toString())

  const el = document.createElement('div')

  el.className = 'fixed left-[-100%] text-fg truncate max-w-[200px]'
  el.id = 'ghost'
  el.innerHTML = props.snippet.name

  document.body.appendChild(el)
  event.dataTransfer?.setDragImage(el, 0, 0)

  setTimeout(() => el.remove(), 0)
}

onClickOutside(snippetRef, () => {
  isFocused.value = false
  highlightedSnippetId.value = undefined
})
</script>

<template>
  <div
    ref="snippetRef"
    data-snippet-item
    class="border-border relative not-first:border-t focus-visible:outline-none [&+.is-selected+div]:border-transparent"
    :class="{
      'is-selected': isSelected,
      'is-focused': isFocused,
      'is-highlighted': isHighlighted,
    }"
    draggable="true"
    @click="onSnippetClick(snippet.id)"
    @contextmenu="onClickContextMenu"
    @dragstart.stop="onDragStart"
  >
    <ContextMenu.Root>
      <ContextMenu.Trigger>
        <div class="flex flex-col p-2 select-none">
          <div
            class="mb-2 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
          >
            {{ snippet.name || i18n.t("snippet.untitled") }}
          </div>
          <div class="meta text-text-muted flex justify-between text-xs">
            <div>
              {{ snippet.folder?.name || "Inbox" }}
            </div>
            <div>
              {{ format(new Date(snippet.createdAt), "dd.MM.yyyy") }}
            </div>
          </div>
        </div>
      </ContextMenu.Trigger>
      <ContextMenu.Content>
        <ContextMenu.Item @click="onDuplicate">
          {{ i18n.t("duplicate") }}
        </ContextMenu.Item>
        <ContextMenu.Item @click="onDelete">
          {{ i18n.t("delete") }}
        </ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu.Root>
  </div>
</template>

<style lang="scss">
@reference "../../styles.css";
[data-snippet-item] {
  &.is-selected {
    @apply bg-list-selection text-list-selection-fg rounded-md;
    .meta {
      @apply text-list-selection-fg;
    }
  }
  &.is-focused {
    @apply bg-list-focus text-list-focus-fg rounded-md;
    .meta {
      @apply text-list-focus-fg;
    }
  }
  &.is-highlighted {
    @apply outline-list-focus rounded-md outline-2 -outline-offset-2;
    &.is-focused,
    &.is-selected {
      @apply bg-bg text-list-selection-fg;
      .meta {
        @apply text-list-selection-fg;
      }
    }
  }
}
</style>
