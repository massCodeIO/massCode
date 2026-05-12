<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import * as Popover from '@/components/ui/shadcn/popover'
import { useNotes, useNotesApp, useNoteSearch } from '@/composables'
import { i18n } from '@/electron'
import {
  Check,
  FileText,
  ListTodo,
  MoreHorizontal,
  Search,
  X,
} from 'lucide-vue-next'

const {
  isSearch,
  createNoteAndSelect,
  createNoteBySelectedKindAndSelect,
  createTaskAndSelect,
} = useNotes()
const {
  searchQuery,
  clearSearch,
  search,
  searchSelectedIndex,
  selectSearchNote,
  displayedNotes,
} = useNoteSearch()
const { isFocusedSearch, notesCreateKind } = useNotesApp()
const isCreateMenuOpen = ref(false)

const createActionTooltip = computed(() =>
  notesCreateKind.value === 'task'
    ? i18n.t('action.new.task')
    : i18n.t('action.new.note'),
)

async function onCreateNote() {
  isCreateMenuOpen.value = false
  await createNoteAndSelect()
}

async function onCreateTask() {
  isCreateMenuOpen.value = false
  await createTaskAndSelect()
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
</script>

<template>
  <div class="border-border mt-[var(--content-top-offset)] mb-2 border-b pb-1">
    <div class="flex items-center px-1">
      <Search class="text-muted-foreground ml-1 h-4 w-4" />
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
        <ListTodo
          v-if="notesCreateKind === 'task'"
          class="h-4 w-4"
        />
        <FileText
          v-else
          class="h-4 w-4"
        />
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
            @click="onCreateNote"
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
            @click="onCreateTask"
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
