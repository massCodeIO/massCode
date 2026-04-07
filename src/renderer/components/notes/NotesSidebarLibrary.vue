<script setup lang="ts">
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import {
  useNoteFolders,
  useNotes,
  useNotesApp,
  useNoteSearch,
} from '@/composables'
import { LibraryFilter } from '@/composables/types'
import { i18n } from '@/electron'
import { router, RouterName } from '@/router'
import { onClickOutside } from '@vueuse/core'
import { Archive, Inbox, Star, Trash } from 'lucide-vue-next'
import { useRoute } from 'vue-router'

const { notesState } = useNotesApp()
const { clearFolderSelection } = useNoteFolders()
const {
  getNotes,
  selectFirstNote,
  withNotesLoading,
  isRestoreStateBlocked,
  emptyTrash,
} = useNotes()
const { clearSearch } = useNoteSearch()
const route = useRoute()

const libraryItems = [
  { id: LibraryFilter.Inbox, name: i18n.t('common.inbox'), icon: Inbox },
  {
    id: LibraryFilter.Favorites,
    name: i18n.t('common.favorites'),
    icon: Star,
  },
  {
    id: LibraryFilter.All,
    name: i18n.t('spaces.notes.allNotes'),
    icon: Archive,
  },
  { id: LibraryFilter.Trash, name: i18n.t('common.trash'), icon: Trash },
]

const focusedItemId = ref<string>()
const itemRef = ref<HTMLElement>()

function isItemSelected(item: (typeof libraryItems)[number]) {
  return (
    route.name === RouterName.notesSpace && notesState.libraryFilter === item.id
  )
}

async function onItemClick(item: (typeof libraryItems)[number]) {
  const { id } = item
  focusedItemId.value = id

  if (route.name !== RouterName.notesSpace) {
    await router.push({ name: RouterName.notesSpace })
  }

  await withNotesLoading(async () => {
    isRestoreStateBlocked.value = true
    clearSearch()

    notesState.libraryFilter = id
    clearFolderSelection()
    notesState.tagId = undefined

    if (id === LibraryFilter.Favorites) {
      await getNotes({ isFavorites: 1 })
    }
    else if (id === LibraryFilter.Trash) {
      await getNotes({ isDeleted: 1 })
    }
    else if (id === LibraryFilter.All) {
      await getNotes({ isDeleted: 0 })
    }
    else if (id === LibraryFilter.Inbox) {
      await getNotes({ isInbox: 1 })
    }

    selectFirstNote()
  })
}

onClickOutside(itemRef, () => {
  focusedItemId.value = undefined
})
</script>

<template>
  <div
    ref="itemRef"
    class="shrink-0 overflow-hidden"
    data-notes-sidebar-library
  >
    <ContextMenu.ContextMenu>
      <ContextMenu.ContextMenuTrigger>
        <div class="px-1">
          <div
            v-for="item in libraryItems"
            :key="item.id"
            data-sidebar-item
            :data-selected="isItemSelected(item) ? 'true' : undefined"
            :data-focused="focusedItemId === item.id ? 'true' : undefined"
            class="data-[selected=true]:bg-accent data-[focused=true]:bg-primary! data-[focused=true]:text-primary-foreground rounded-md"
            :class="{
              'hover:bg-accent-hover':
                !isItemSelected(item) && focusedItemId !== item.id,
            }"
            @click="onItemClick(item)"
          >
            <div class="ml-5.5 flex items-center">
              <component
                :is="item.icon"
                class="mr-0.5 h-4 w-4"
              />
              <div class="ml-1 select-none">
                {{ item.name }}
              </div>
            </div>
          </div>
        </div>
      </ContextMenu.ContextMenuTrigger>
      <ContextMenu.ContextMenuContent>
        <ContextMenu.ContextMenuItem @click="emptyTrash">
          {{ i18n.t("action.delete.trash") }}
        </ContextMenu.ContextMenuItem>
      </ContextMenu.ContextMenuContent>
    </ContextMenu.ContextMenu>
  </div>
</template>
