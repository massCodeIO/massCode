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
import {
  Archive,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Inbox,
  ListTodo,
  Star,
  Trash,
} from 'lucide-vue-next'
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
  {
    id: LibraryFilter.Tasks,
    name: i18n.t('notes.tasks.title'),
    icon: ListTodo,
  },
  {
    id: LibraryFilter.Today,
    name: i18n.t('notes.tasks.today'),
    icon: CalendarCheck,
    isNested: true,
  },
  {
    id: LibraryFilter.Upcoming,
    name: i18n.t('notes.tasks.upcoming'),
    icon: CalendarClock,
    isNested: true,
  },
  {
    id: LibraryFilter.Completed,
    name: i18n.t('notes.tasks.completed'),
    icon: CheckCircle2,
    isNested: true,
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
    else if (id === LibraryFilter.Tasks) {
      await getNotes({ propertyType: 'task' })
    }
    else if (id === LibraryFilter.Today) {
      await getNotes({
        propertyDue: 'today',
        propertyStatusNot: 'done',
        propertyType: 'task',
      })
    }
    else if (id === LibraryFilter.Upcoming) {
      await getNotes({
        propertyDue: 'upcoming',
        propertyStatusNot: 'done',
        propertyType: 'task',
      })
    }
    else if (id === LibraryFilter.Completed) {
      await getNotes({
        propertyStatus: 'done',
        propertyType: 'task',
      })
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
            <div
              class="flex items-center"
              :class="item.isNested ? 'ml-9' : 'ml-5.5'"
            >
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
