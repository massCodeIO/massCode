<script setup lang="ts">
import type { SnippetsResponse } from '@/services/api/generated'
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import { useApp, useDialog, useSnippets } from '@/composables'
import { LibraryFilter } from '@/composables/types'
import { i18n } from '@/electron'
import { onClickOutside } from '@vueuse/core'
import { format } from 'date-fns'

interface Props {
  snippet: SnippetsResponse[0]
}

const props = defineProps<Props>()

const {
  selectedSnippetId,
  highlightedSnippetIds,
  highlightedFolderId,
  selectedSnippetIdBeforeSearch,
  isFocusedSnippetName,
  selectedLibrary,
} = useApp()

const {
  selectSnippet,
  isSearch,
  selectFirstSnippet,
  duplicateSnippet,
  selectedSnippetIds,
  updateSnippet,
  updateSnippets,
  deleteSnippet,
  deleteSnippets,
  displayedSnippets,
} = useSnippets()

const { confirm } = useDialog()

const isFocused = ref(false)
const snippetRef = ref<HTMLDivElement>()

const isSelected = computed(() => selectedSnippetId.value === props.snippet.id)
const isInMultiSelection = computed(
  () =>
    selectedSnippetIds.value.length > 1
    && selectedSnippetIds.value.includes(props.snippet.id),
)
const isHighlighted = computed(() =>
  highlightedSnippetIds.value.has(props.snippet.id),
)

const isDuplicateDisabled = computed(
  () => highlightedSnippetIds.value.size > 1,
)

const isFavoritesLibrarySelected = computed(
  () => selectedLibrary.value === LibraryFilter.Favorites,
)

const isTrashLibrarySelectd = computed(
  () => selectedLibrary.value === LibraryFilter.Trash,
)

const folderName = computed(() => {
  if (props.snippet.folder) {
    return props.snippet.folder.name
  }

  if (props.snippet.isDeleted) {
    return i18n.t('sidebar.trash')
  }

  return i18n.t('sidebar.inbox')
})

function onSnippetClick(id: number, event: MouseEvent) {
  selectSnippet(id, event.shiftKey)

  if (!isSearch.value) {
    selectedSnippetIdBeforeSearch.value = id
  }

  isFocused.value = true
}

function onClickContextMenu() {
  highlightedFolderId.value = undefined
  highlightedSnippetIds.value.clear()
  highlightedSnippetIds.value.add(props.snippet.id)

  if (selectedSnippetIds.value.length > 1) {
    selectedSnippetIds.value.forEach(id =>
      highlightedSnippetIds.value.add(id),
    )
  }
}

async function onAddFavorites() {
  const isFavorites = isFavoritesLibrarySelected.value ? 0 : 1

  if (selectedSnippetIds.value.length > 1) {
    const snippetsData = selectedSnippetIds.value?.map(() => ({ isFavorites }))
    await updateSnippets(selectedSnippetIds.value, snippetsData)
  }
  else {
    await updateSnippet(props.snippet.id, { isFavorites })
  }
  if (isFavoritesLibrarySelected.value) {
    if (
      selectedSnippetIds.value.length > 1
      || selectedSnippetId.value === props.snippet.id
    ) {
      selectFirstSnippet()
    }
  }
}

async function onDelete() {
  if (selectedSnippetIds.value.length > 1) {
    const isAllSoftDeleted = displayedSnippets.value?.every(s => s.isDeleted)

    if (isAllSoftDeleted) {
      const isConfirmed = await confirm({
        title: i18n.t('dialog:deleteConfirmMultipleSnippets', {
          count: selectedSnippetIds.value.length,
        }),
        content: i18n.t('dialog:noUndo'),
      })

      if (isConfirmed) {
        await deleteSnippets(selectedSnippetIds.value)
      }
    }
    else {
      // Мягкое удаление
      const snippetsData = selectedSnippetIds.value?.map(() => ({
        folderId: null,
        isDeleted: 1,
      }))

      await updateSnippets(selectedSnippetIds.value, snippetsData)
    }
  }
  else if (props.snippet.isDeleted) {
    const isConfirmed = await confirm({
      title: i18n.t('dialog:deleteConfirmPermanently', {
        name: props.snippet.name,
      }),
      content: i18n.t('dialog:noUndo'),
    })

    if (isConfirmed) {
      await deleteSnippet(props.snippet.id)
    }
  }
  else {
    // Мягкое удаление
    await updateSnippet(props.snippet.id, {
      folderId: null,
      isDeleted: 1,
    })
  }

  if (
    selectedSnippetIds.value.length > 1
    || selectedSnippetId.value === props.snippet.id
  ) {
    selectFirstSnippet()
  }
}

async function onDuplicate() {
  await duplicateSnippet(props.snippet.id)
  selectFirstSnippet()
  isFocusedSnippetName.value = true
}

function onDragStart(event: DragEvent) {
  const ids
    = selectedSnippetIds.value.length > 1
      ? selectedSnippetIds.value
      : [props.snippet.id]

  event.dataTransfer?.setData('snippetIds', JSON.stringify(ids))

  const el = document.createElement('div')

  if (selectedSnippetIds.value.length > 1) {
    el.className
      = 'fixed left-[-100%] text-fg truncate max-w-[200px] flex items-center'
    el.id = 'ghost'
    el.innerHTML = `
      <span class="rounded-full bg-primary text-white px-2 py-0.5 text-xs ml-3">
        ${selectedSnippetIds.value.length}
      </span>
    `
  }
  else {
    el.className = 'fixed left-[-100%] text-fg truncate max-w-[200px]'
    el.id = 'ghost'
    el.innerHTML = props.snippet.name
  }

  document.body.appendChild(el)
  event.dataTransfer?.setDragImage(el, 0, 0)

  setTimeout(() => el.remove(), 0)
}

onClickOutside(snippetRef, () => {
  isFocused.value = false
  highlightedSnippetIds.value.clear()
})
</script>

<template>
  <div
    ref="snippetRef"
    data-snippet-item
    class="border-border relative px-1 not-first:border-t focus-visible:outline-none [&+.is-selected+div]:border-transparent"
    :class="{
      'is-selected': isSelected,
      'is-multi-selected': isInMultiSelection,
      'is-focused': isFocused,
      'is-highlighted': isHighlighted,
    }"
    draggable="true"
    @click="(event) => onSnippetClick(snippet.id, event)"
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
              {{ folderName }}
            </div>
            <div>
              {{ format(new Date(snippet.createdAt), "dd.MM.yyyy") }}
            </div>
          </div>
        </div>
      </ContextMenu.Trigger>
      <ContextMenu.Content>
        <template v-if="!isTrashLibrarySelectd">
          <ContextMenu.Item @click="onAddFavorites">
            {{
              isFavoritesLibrarySelected
                ? i18n.t("removeFromFavorites")
                : i18n.t("addToFavorites")
            }}
          </ContextMenu.Item>
          <ContextMenu.Separator />
          <ContextMenu.Item
            :disabled="isDuplicateDisabled"
            @click="onDuplicate"
          >
            {{ i18n.t("duplicate") }}
          </ContextMenu.Item>
        </template>
        <ContextMenu.Item @click="onDelete">
          {{
            selectedLibrary === LibraryFilter.Trash
              ? i18n.t("delete")
              : i18n.t("moveToTrash")
          }}
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
  &.is-multi-selected {
    @apply bg-list-selection/80 text-list-selection-fg rounded-md;
    .meta {
      @apply text-list-selection-fg;
    }
  }
  &.is-focused:not(.is-multi-selected) {
    @apply bg-list-focus text-list-focus-fg rounded-md;
    .meta {
      @apply text-list-focus-fg;
    }
  }
  &.is-highlighted {
    @apply outline-list-focus rounded-md outline-2 -outline-offset-2;
    &.is-focused,
    &.is-selected,
    &.is-multi-selected {
      @apply bg-bg text-list-selection-fg;
      .meta {
        @apply text-list-selection-fg;
      }
    }
  }
}
</style>
