<script setup lang="ts">
import * as ContextMenu from '@/components/ui/shadcn/context-menu'
import { useHttpApp, useHttpRequests } from '@/composables'
import { useHttpWorkspaceNavigation } from '@/composables/spaces/http/useHttpWorkspaceNavigation'
import { LibraryFilter } from '@/composables/types'
import { i18n } from '@/electron'
import { RouterName } from '@/router'
import { onClickOutside } from '@vueuse/core'
import { Archive, FolderTree, Inbox, Star, Trash } from 'lucide-vue-next'
import { useRoute } from 'vue-router'

const { httpState } = useHttpApp()
const { emptyTrash } = useHttpRequests()
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
    name: i18n.t('spaces.http.allRequests'),
    icon: Archive,
  },
  { id: LibraryFilter.Trash, name: i18n.t('common.trash'), icon: Trash },
  {
    id: undefined,
    name: i18n.t('spaces.http.tree.collections'),
    icon: FolderTree,
  },
]

const focusedItemId = ref<string>()
const itemRef = ref<HTMLElement>()

function isItemSelected(item: (typeof libraryItems)[number]) {
  return (
    route.name === RouterName.httpSpace && httpState.libraryFilter === item.id
  )
}

async function onItemClick(item: (typeof libraryItems)[number]) {
  if (await useHttpWorkspaceNavigation().openHttpLibrary(item.id))
    focusedItemId.value = item.id ?? 'collections'
}

onClickOutside(itemRef, () => {
  focusedItemId.value = undefined
})
</script>

<template>
  <div
    ref="itemRef"
    class="shrink-0 overflow-hidden"
    data-http-sidebar-library
  >
    <ContextMenu.ContextMenu>
      <ContextMenu.ContextMenuTrigger>
        <div class="px-1">
          <div
            v-for="item in libraryItems"
            :key="item.id ?? 'collections'"
            data-sidebar-item
            :data-selected="isItemSelected(item) ? 'true' : undefined"
            :data-focused="
              focusedItemId === (item.id ?? 'collections') ? 'true' : undefined
            "
            class="data-[selected=true]:bg-accent data-[focused=true]:bg-primary! data-[focused=true]:text-primary-foreground rounded-md"
            :class="{
              'hover:bg-accent-hover':
                !isItemSelected(item)
                && focusedItemId !== (item.id ?? 'collections'),
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
