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
import { useDebounceFn } from '@vueuse/core'
import {
  Check,
  FileText,
  ListTodo,
  MoreHorizontal,
  Plus,
  Search,
  X,
} from 'lucide-vue-next'

const { isSearch, createNoteBySelectedKindAndSelect } = useNotes()
const {
  searchQuery,
  clearSearch,
  search,
  searchSelectedIndex,
  selectSearchNote,
  displayedNotes,
} = useNoteSearch()
const { isFocusedSearch, notesCreateKind, notesState } = useNotesApp()
const { folders, getFolderByIdFromTree } = useNoteFolders()
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

const searchPlaceholder = computed(() =>
  searchContextLabel.value
    ? i18n.t('placeholder.searchIn', { context: searchContextLabel.value })
    : i18n.t('placeholder.searchNotes'),
)

function selectCreateKind(kind: 'note' | 'task') {
  notesCreateKind.value = kind
  isCreateMenuOpen.value = false
}

// Без debounce каждый символ порождает full-text запрос, смену выбранной
// заметки и перезагрузку документа в редакторе.
const searchDebounced = useDebounceFn(() => {
  if (searchQuery.value) {
    search()
  }
}, 200)

watch(searchQuery, (v) => {
  if (v) {
    searchDebounced()
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
</script>

<template>
  <div class="border-border mt-[var(--content-top-offset)] mb-2 border-b pb-1">
    <div class="flex items-center px-1">
      <Search class="text-muted-foreground ml-1 h-4 w-4 shrink-0" />
      <div class="min-w-0 flex-grow">
        <UiInput
          v-model="searchQuery"
          :placeholder="searchPlaceholder"
          variant="ghost"
          class="truncate"
          :focus="isFocusedSearch"
          @blur="isFocusedSearch = false"
          @keydown="onKeydown"
        />
      </div>
      <UiActionButton
        v-if="searchQuery"
        :tooltip="i18n.t('action.clearSearch')"
        @click="clearSearch(true)"
      >
        <X class="h-4 w-4" />
      </UiActionButton>
      <UiActionButton
        v-else-if="!isSearch"
        :tooltip="createActionTooltip"
        @click="createNoteBySelectedKindAndSelect"
      >
        <Plus class="h-4 w-4" />
      </UiActionButton>
      <Popover.Popover
        v-if="!searchQuery && !isSearch"
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
