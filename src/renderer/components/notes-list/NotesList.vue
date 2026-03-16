<script setup lang="ts">
import { useNotes, useNotesApp } from '@/composables'
import { i18n } from '@/electron'

const NOTE_ITEM_SIZE = 61

const { notesState } = useNotesApp()
const { displayedNotes } = useNotes()

const noteScrollerRef = ref<{
  scrollToItem: (index: number) => void
} | null>(null)
const isInitialPositionRestored = ref(false)

watch(
  [displayedNotes, () => notesState.noteId, noteScrollerRef],
  ([notes, noteId, scroller]) => {
    if (isInitialPositionRestored.value)
      return

    if (!scroller || !notes?.length || noteId === undefined)
      return

    const index = notes.findIndex(note => note.id === noteId)

    if (index < 0)
      return

    isInitialPositionRestored.value = true

    nextTick(() => {
      requestAnimationFrame(() => {
        scroller.scrollToItem(index)
      })
    })
  },
  {
    immediate: true,
    flush: 'post',
  },
)
</script>

<template>
  <div
    data-notes-list
    class="flex h-full flex-col"
  >
    <div>
      <NotesListHeader />
    </div>
    <RecycleScroller
      v-if="displayedNotes?.length"
      :ref="(el: any) => (noteScrollerRef = el)"
      v-slot="{ item }"
      class="scrollbar flex-grow px-2"
      :items="displayedNotes"
      :item-size="NOTE_ITEM_SIZE"
      key-field="id"
    >
      <NotesListItem :note="item" />
    </RecycleScroller>
    <UiEmptyPlaceholder
      v-else
      :text="i18n.t('placeholder.emptyNotesList')"
    />
  </div>
</template>
