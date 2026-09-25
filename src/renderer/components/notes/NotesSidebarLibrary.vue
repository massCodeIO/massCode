<script setup lang="ts">
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import { useNotes, useNotesApp } from '@/composables'
import { useNotesWorkspaceNavigation } from '@/composables/spaces/notes/useNotesWorkspaceNavigation'
import { LibraryFilter } from '@/composables/types'
import { i18n } from '@/electron'
import { RouterName } from '@/router'
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
const { emptyTrash, cleanupCompletedTasks } = useNotes()
const { openNotesLibrary } = useNotesWorkspaceNavigation()
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
  focusedItemId.value = item.id
  await openNotesLibrary(item.id)
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
        <ContextMenu.ContextMenuItem @click="cleanupCompletedTasks()">
          {{ i18n.t("notes.tasks.cleanupCompleted") }}
        </ContextMenu.ContextMenuItem>
        <ContextMenu.ContextMenuSeparator />
        <ContextMenu.ContextMenuItem @click="emptyTrash">
          {{ i18n.t("action.delete.trash") }}
        </ContextMenu.ContextMenuItem>
      </ContextMenu.ContextMenuContent>
    </ContextMenu.ContextMenu>
  </div>
</template>
