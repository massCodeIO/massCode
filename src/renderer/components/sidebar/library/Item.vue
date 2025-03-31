<script setup lang="ts">
import type { SnippetsQuery } from '~/renderer/services/api/generated'
import { useApp, useSnippets } from '@/composables'
import { LibraryFilter } from '@/composables/types'
import { store } from '@/electron'
import { onClickOutside } from '@vueuse/core'

const props = defineProps<Props>()

interface Props {
  id: (typeof LibraryFilter)[keyof typeof LibraryFilter]
  name: string
  icon: Component
}

const { selectedLibrary, selectedFolderId, selectedTagId } = useApp()

const { getSnippets, selectFirstSnippet } = useSnippets()

const isFocused = ref(false)
const itemRef = ref<HTMLElement>()
const isSelected = computed(() => selectedLibrary.value === props.id)

async function onItemClick(
  id: (typeof LibraryFilter)[keyof typeof LibraryFilter],
) {
  selectedLibrary.value = id
  isFocused.value = true
  selectedFolderId.value = undefined
  selectedTagId.value = undefined

  store.app.delete('selectedFolderId')
  store.app.set('selectedLibrary', id)

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
