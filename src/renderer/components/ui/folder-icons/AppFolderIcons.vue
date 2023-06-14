<template>
  <div class="app-folder-icons">
    <div class="search">
      <AppInput
        ref="refInput"
        v-model="search"
        :placeholder="`${i18n.t('search')}...`"
      />
      <AppButton @click="onReset">
        Reset
      </AppButton>
    </div>
    <PerfectScrollbar>
      <div class="icons">
        <AppFolderIconsItem
          v-for="i in iconsBySearch"
          :key="i.name"
          :name="i.name!"
          :source="i.source"
          @click="onClick(i.name!)"
        />
      </div>
    </PerfectScrollbar>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount, onMounted } from 'vue'
import { icons } from './icons'
import { i18n } from '@/electron'
import { useFolderStore } from '@/store/folders'
import { track } from '@/services/analytics'

const folderStore = useFolderStore()

const search = ref('')
const refInput = ref<HTMLElement>()

const iconsBySearch = computed(() => {
  if (search.value === '') {
    return icons
  }
  return icons.filter(i => i.name?.includes(search.value.toLowerCase()))
})

const onClick = async (name: string) => {
  if (folderStore.selectedContextId) {
    await folderStore.patchFoldersById(folderStore.selectedContextId, {
      icon: name
    })
    track('folders/set-custom-icon')
  }
}

const onReset = async () => {
  if (folderStore.selectedContextId) {
    await folderStore.patchFoldersById(folderStore.selectedContextId, {
      icon: null
    })
  }
}

onMounted(() => {
  const inputEl = document.querySelector<HTMLInputElement>(
    '.app-folder-icons input'
  )!
  inputEl.focus()
})

onBeforeUnmount(() => {
  folderStore.selectedContextId = undefined
})
</script>

<style lang="scss" scoped>
.app-folder-icons {
  padding: var(--spacing-sm);
  .search {
    margin-bottom: var(--spacing-sm);
    input {
      width: 100%;
    }
  }
  .search {
    display: flex;
    gap: var(--spacing-sm);
  }
  .icons {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    grid-auto-rows: 36px;
    gap: 4px;
  }
  :deep(.ps) {
    height: 270px;
  }
}
</style>
