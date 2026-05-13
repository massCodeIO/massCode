<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import * as Popover from '@/components/ui/shadcn/popover'
import {
  useNoteFolders,
  useNotes,
  useNotesApp,
  useNoteSearch,
  useNoteTags,
} from '@/composables'
import { LibraryFilter } from '@/composables/types'
import { i18n } from '@/electron'
import {
  Check,
  FileText,
  ListTodo,
  MoreHorizontal,
  Plus,
  Search,
  X,
} from 'lucide-vue-next'

const {
  isSearch,
  createNoteBySelectedKindAndSelect,
  getNotes,
  isRestoreStateBlocked,
  selectFirstNote,
  withNotesLoading,
} = useNotes()
const {
  searchQuery,
  clearSearch,
  search,
  searchSelectedIndex,
  selectSearchNote,
  displayedNotes,
} = useNoteSearch()
const { isFocusedSearch, notesCreateKind, notesState } = useNotesApp()
const { clearFolderSelection, folders, getFolderByIdFromTree }
  = useNoteFolders()
const { tags } = useNoteTags()
const isCreateMenuOpen = ref(false)

const libraryFilterLabels = computed<Record<string, string>>(() => ({
  [LibraryFilter.Inbox]: i18n.t('common.inbox'),
  [LibraryFilter.Favorites]: i18n.t('common.favorites'),
  [LibraryFilter.All]: i18n.t('spaces.notes.allNotes'),
  [LibraryFilter.Tasks]: i18n.t('notes.tasks.title'),
  [LibraryFilter.Today]: i18n.t('notes.tasks.today'),
  [LibraryFilter.Upcoming]: i18n.t('notes.tasks.upcoming'),
  [LibraryFilter.Completed]: i18n.t('notes.tasks.completed'),
  [LibraryFilter.Trash]: i18n.t('common.trash'),
}))

const createActionTooltip = computed(() =>
  notesCreateKind.value === 'task'
    ? i18n.t('action.new.task')
    : i18n.t('action.new.note'),
)

const searchContextLabel = computed(() => {
  if (notesState.tagId) {
    const tag = tags.value.find(item => item.id === notesState.tagId)
    return tag ? `#${tag.name}` : undefined
  }

  if (notesState.folderId) {
    return getFolderByIdFromTree(folders.value, notesState.folderId)?.name
  }

  return notesState.libraryFilter
    ? libraryFilterLabels.value[notesState.libraryFilter]
    : undefined
})

function selectCreateKind(kind: 'note' | 'task') {
  notesCreateKind.value = kind
  isCreateMenuOpen.value = false
}

watch(searchQuery, (v) => {
  if (v) {
    search()
  }
  else {
    clearSearch(true)
  }
})

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    const nextIndex = Math.min(
      searchSelectedIndex.value + 1,
      (displayedNotes.value?.length || 0) - 1,
    )
    selectSearchNote(nextIndex)
  }
  else if (event.key === 'ArrowUp') {
    event.preventDefault()
    const prevIndex = Math.max(searchSelectedIndex.value - 1, 0)
    selectSearchNote(prevIndex)
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    clearSearch(true)
  }
}

async function clearSearchContext() {
  await withNotesLoading(async () => {
    if (notesState.tagId) {
      notesState.tagId = undefined
    }
    else if (notesState.folderId) {
      clearFolderSelection()
    }
    else if (notesState.libraryFilter) {
      notesState.libraryFilter = undefined
    }

    isRestoreStateBlocked.value = true
    await getNotes()
    selectFirstNote()
  })
}
</script>

<template>
  <div class="border-border mt-[var(--content-top-offset)] mb-2 border-b pb-1">
    <div class="flex items-center px-1">
      <Search class="text-muted-foreground ml-1 h-4 w-4" />
      <div
        v-if="searchContextLabel"
        class="bg-muted text-muted-foreground ml-2 flex max-w-32 shrink-0 items-center rounded-full px-2 py-0.5 text-xs"
      >
        <span class="truncate">{{ searchContextLabel }}</span>
        <Button
          variant="ghost"
          size="icon"
          class="ml-1 size-4 rounded-full p-0"
          :aria-label="i18n.t('action.close')"
          @click="clearSearchContext"
        >
          <X class="size-3" />
        </Button>
      </div>
      <div class="flex-grow">
        <UiInput
          v-model="searchQuery"
          :placeholder="i18n.t('placeholder.searchNotes')"
          variant="ghost"
          :focus="isFocusedSearch"
          @blur="isFocusedSearch = false"
          @keydown="onKeydown"
        />
      </div>
      <Button
        v-if="searchQuery"
        variant="ghost"
        @click="clearSearch(true)"
      >
        <X class="h-4 w-4" />
      </Button>
      <UiActionButton
        v-if="!isSearch"
        :tooltip="createActionTooltip"
        @click="createNoteBySelectedKindAndSelect"
      >
        <Plus class="h-4 w-4" />
      </UiActionButton>
      <Popover.Popover
        v-if="!isSearch"
        v-model:open="isCreateMenuOpen"
      >
        <Popover.PopoverTrigger as-child>
          <UiActionButton :aria-label="i18n.t('action.createOptions')">
            <MoreHorizontal class="h-4 w-4" />
          </UiActionButton>
        </Popover.PopoverTrigger>
        <Popover.PopoverContent
          align="end"
          class="w-36 p-1"
        >
          <Button
            variant="ghost"
            size="sm"
            class="w-full justify-start"
            @click="selectCreateKind('note')"
          >
            <FileText class="h-4 w-4" />
            {{ i18n.t("action.new.note") }}
            <Check
              v-if="notesCreateKind === 'note'"
              class="ml-auto h-4 w-4"
            />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            class="w-full justify-start"
            @click="selectCreateKind('task')"
          >
            <ListTodo class="h-4 w-4" />
            {{ i18n.t("action.new.task") }}
            <Check
              v-if="notesCreateKind === 'task'"
              class="ml-auto h-4 w-4"
            />
          </Button>
        </Popover.PopoverContent>
      </Popover.Popover>
    </div>
  </div>
</template>
