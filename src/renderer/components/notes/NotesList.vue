<script setup lang="ts">
import {
  useApp,
  useDeleteShortcut,
  useNotes,
  useNotesApp,
  useNoteSearch,
} from '@/composables'
import { i18n } from '@/electron'
import { LoaderCircle } from 'lucide-vue-next'

const NOTE_ITEM_SIZE = 61
const NOTE_ITEM_COMPACT_SIZE = 37

const { isCompactListMode } = useApp()
const { focusedNoteId, notesState } = useNotesApp()
const { deleteSelectedNotes, isNotesLoading, isNotesLoadingVisible }
  = useNotes()
const { displayedNotes } = useNoteSearch()

const noteScrollerRef = ref<{
  scrollToItem: (index: number) => void
} | null>(null)
const isInitialPositionRestored = ref(false)
const noteItemSize = computed(() =>
  isCompactListMode.value ? NOTE_ITEM_COMPACT_SIZE : NOTE_ITEM_SIZE,
)

useDeleteShortcut({
  rootSelector: '[data-notes-list]',
  isEnabled: () => focusedNoteId.value !== undefined,
  onDelete: deleteSelectedNotes,
})

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
      :item-size="noteItemSize"
      key-field="id"
    >
      <NotesListItem :note="item" />
    </RecycleScroller>
    <UiEmptyPlaceholder
      v-else-if="!isNotesLoading"
      :text="i18n.t('placeholder.emptyNotesList')"
    />
    <div
      v-else-if="isNotesLoadingVisible"
      class="text-muted-foreground flex flex-1 items-center justify-center"
    >
      <LoaderCircle class="h-4 w-4 animate-spin" />
    </div>
    <div
      v-else
      class="flex-1"
    />
  </div>
</template>
