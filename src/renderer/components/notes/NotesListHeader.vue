<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import { useNotes, useNotesApp } from '@/composables'
import { i18n } from '@/electron'
import { Plus, Search, X } from 'lucide-vue-next'

const {
  isSearch,
  searchQuery,
  createNoteAndSelect,
  clearSearch,
  search,
  searchSelectedIndex,
  selectSearchNote,
  displayedNotes,
} = useNotes()
const { isFocusedSearch } = useNotesApp()

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
        :tooltip="i18n.t('action.new.note')"
        @click="createNoteAndSelect"
      >
        <Plus class="h-4 w-4" />
      </UiActionButton>
    </div>
  </div>
</template>
