<script setup lang="ts">
import type { SnippetsQuery } from '~/renderer/services/api/generated'
import { useApp, useSnippets } from '@/composables'
import { LibraryFilter } from '@/composables/types'
import { onClickOutside } from '@vueuse/core'

const props = defineProps<Props>()

interface Props {
  id: (typeof LibraryFilter)[keyof typeof LibraryFilter]
  name: string
  icon: Component
}

const { state } = useApp()

const { getSnippets, selectFirstSnippet, clearSearch, isRestoreStateBlocked }
  = useSnippets()

const isFocused = ref(false)
const itemRef = ref<HTMLElement>()
const isSelected = computed(() => state.libraryFilter === props.id)

async function onItemClick(
  id: (typeof LibraryFilter)[keyof typeof LibraryFilter],
) {
  isFocused.value = true
  isRestoreStateBlocked.value = true
  clearSearch()

  state.libraryFilter = id
  state.folderId = undefined
  state.tagId = undefined

  const query: SnippetsQuery = {}

  if (id === LibraryFilter.Favorites) {
    query.isFavorites = 1
  }
  else if (id === LibraryFilter.Trash) {
    query.isDeleted = 1
  }
  else if (id === LibraryFilter.All) {
    query.isDeleted = 0
  }
  else if (id === LibraryFilter.Inbox) {
    query.isInbox = 1
  }

  await getSnippets(query)
  selectFirstSnippet()
}

onClickOutside(itemRef, () => {
  isFocused.value = false
})
</script>

<template>
  <div
    ref="itemRef"
    data-sidebar-item
    :data-selected="isSelected ? 'true' : undefined"
    :data-focused="isFocused ? 'true' : undefined"
    class="data-[selected=true]:bg-list-selection data-[focused=true]:bg-list-focus! data-[focused=true]:text-list-focus-fg rounded-md"
    @click="onItemClick(id)"
  >
    <div class="ml-5.5 flex items-center">
      <component
        :is="icon"
        class="mr-0.5 h-4 w-4"
      />
      <div class="ml-1 select-none">
        {{ name }}
      </div>
    </div>
  </div>
</template>
