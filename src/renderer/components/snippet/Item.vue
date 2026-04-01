<script setup lang="ts">
import type { SnippetsResponse } from '@/services/api/generated'
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import {
  useApp,
  useDialog,
  useNavigationHistory,
  useSnippets,
} from '@/composables'
import { LibraryFilter } from '@/composables/types'
import { i18n } from '@/electron'
import { onClickOutside, useClipboard } from '@vueuse/core'
import { format } from 'date-fns'

interface Props {
  snippet: SnippetsResponse[0]
}

const props = defineProps<Props>()

const {
  highlightedSnippetIds,
  highlightedFolderIds,
  isCompactListMode,
  isFocusedSnippetName,
  focusedSnippetId,
  state,
} = useApp()

const {
  selectSnippet,
  selectFirstSnippet,
  duplicateSnippet,
  selectedSnippetIds,
  updateSnippet,
  updateSnippets,
  deleteSnippet,
  deleteSnippets,
  displayedSnippets,
} = useSnippets()
const { clearHistory } = useNavigationHistory()

const { confirm } = useDialog()
const { copy } = useClipboard()

const snippetRef = ref<HTMLDivElement>()

const isSelected = computed(() => state.snippetId === props.snippet.id)

const isInMultiSelection = computed(
  () =>
    selectedSnippetIds.value.length > 1
    && selectedSnippetIds.value.includes(props.snippet.id),
)
const isHighlighted = computed(() =>
  highlightedSnippetIds.value.has(props.snippet.id),
)

const isFocused = computed(() => focusedSnippetId.value === props.snippet.id)

const isDuplicateDisabled = computed(
  () => highlightedSnippetIds.value.size > 1,
)

const isFavoritesLibrarySelected = computed(
  () => state.libraryFilter === LibraryFilter.Favorites,
)

const isTrashLibrarySelectd = computed(
  () => state.libraryFilter === LibraryFilter.Trash,
)

const folderName = computed(() => {
  if (props.snippet.folder) {
    return props.snippet.folder.name
  }

  if (props.snippet.isDeleted) {
    return i18n.t('common.trash')
  }

  return i18n.t('common.inbox')
})

function onSnippetClick(id: number, event: MouseEvent) {
  clearHistory()
  selectSnippet(id, event.shiftKey)
  focusedSnippetId.value = id
}

function onClickContextMenu() {
  highlightedFolderIds.value.clear()
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
      || state.snippetId === props.snippet.id
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
        title: i18n.t('messages:confirm.deleteConfirmMultipleSnippets', {
          count: selectedSnippetIds.value.length,
        }),
        content: i18n.t('messages:warning.noUndo'),
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
      title: i18n.t('messages:confirm.deletePermanently', {
        name: props.snippet.name,
      }),
      content: i18n.t('messages:warning.noUndo'),
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
    || state.snippetId === props.snippet.id
  ) {
    selectFirstSnippet()
  }
}

async function onRestore() {
  if (selectedSnippetIds.value.length > 1) {
    const snippetsData = selectedSnippetIds.value?.map(() => ({
      folderId: null,
      isDeleted: 0,
    }))

    await updateSnippets(selectedSnippetIds.value, snippetsData)
  }
  else {
    await updateSnippet(props.snippet.id, {
      folderId: null,
      isDeleted: 0,
    })
  }
}

async function onDuplicate() {
  await duplicateSnippet(props.snippet.id)
  selectFirstSnippet()
  isFocusedSnippetName.value = true
}

function onCopySnippetLink() {
  copy(`masscode://goto?snippetId=${props.snippet.id}`)
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
      = 'fixed left-[-100%] text-foreground truncate max-w-[200px] flex items-center'
    el.id = 'ghost'
    el.innerHTML = `
      <span class="rounded-full bg-primary text-white px-2 py-0.5 text-xs ml-3">
        ${selectedSnippetIds.value.length}
      </span>
    `
  }
  else {
    el.className = 'fixed left-[-100%] text-foreground truncate max-w-[200px]'
    el.id = 'ghost'
    el.innerHTML = props.snippet.name
  }

  document.body.appendChild(el)
  event.dataTransfer?.setDragImage(el, 0, 0)

  setTimeout(() => el.remove(), 0)
}

onClickOutside(snippetRef, () => {
  focusedSnippetId.value = undefined
  highlightedSnippetIds.value.clear()
})
</script>

<template>
  <div
    ref="snippetRef"
    data-snippet-item
    class="border-border relative border-b px-1 focus-visible:outline-none"
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
    <ContextMenu.ContextMenu>
      <ContextMenu.ContextMenuTrigger>
        <div
          class="select-none"
          :class="
            isCompactListMode
              ? 'flex items-center gap-2 px-2 py-1.5'
              : 'flex flex-col p-2'
          "
        >
          <div
            class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
            :class="isCompactListMode ? 'flex-1' : 'mb-2'"
          >
            {{ snippet.name || i18n.t("snippet.untitled") }}
          </div>
          <UiText
            v-if="isCompactListMode"
            as="div"
            variant="xs"
            muted
            class="meta shrink-0"
          >
            {{ format(new Date(snippet.createdAt), "dd.MM.yyyy") }}
          </UiText>
          <UiText
            v-else
            as="div"
            variant="xs"
            muted
            class="meta flex justify-between"
          >
            <div>
              {{ folderName }}
            </div>
            <div>
              {{ format(new Date(snippet.createdAt), "dd.MM.yyyy") }}
            </div>
          </UiText>
        </div>
      </ContextMenu.ContextMenuTrigger>
      <ContextMenu.ContextMenuContent>
        <template v-if="!isTrashLibrarySelectd">
          <ContextMenu.ContextMenuItem @click="onAddFavorites">
            {{
              isFavoritesLibrarySelected
                ? i18n.t("action.remove.fromFavorites")
                : i18n.t("action.add.toFavorites")
            }}
          </ContextMenu.ContextMenuItem>
          <ContextMenu.ContextMenuSeparator />
          <ContextMenu.ContextMenuItem @click="onCopySnippetLink">
            {{ i18n.t("action.copy.snippetLink") }}
          </ContextMenu.ContextMenuItem>
          <ContextMenu.ContextMenuSeparator />
          <ContextMenu.ContextMenuItem
            :disabled="isDuplicateDisabled"
            @click="onDuplicate"
          >
            {{ i18n.t("action.duplicate") }}
          </ContextMenu.ContextMenuItem>
        </template>
        <ContextMenu.ContextMenuItem @click="onDelete">
          {{
            state.libraryFilter === LibraryFilter.Trash
              ? i18n.t("action.delete.common")
              : i18n.t("action.move.toTrash")
          }}
        </ContextMenu.ContextMenuItem>
        <ContextMenu.ContextMenuItem
          v-if="isTrashLibrarySelectd"
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
[data-snippet-item] {
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
