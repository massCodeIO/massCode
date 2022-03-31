<template>
  <div class="main">
    <TheSidebar />
    <SnippetList />
    <SnippetsView />
  </div>
</template>

<script setup lang="ts">
import { store } from '@/electron'
import { useFolderStore } from '@/store/folders'
import { useSnippetStore } from '@/store/snippets'

const folderStore = useFolderStore()
const snippetStore = useSnippetStore()

const init = async () => {
  const storedFolderId = store.app.get('selectedFolderId')
  const storedFolderIds = store.app.get('selectedFolderIds')
  const storedSnippetId = store.app.get('selectedSnippetId')
  const firstFolderId = folderStore.main[0]?.id
  const firstSnippetId = snippetStore.snippets[0]?.id

  await folderStore.getFolders()
  folderStore.selectId(storedFolderId || firstFolderId)
  await snippetStore.getSnippetsByFolderIds(storedFolderIds || [firstFolderId])
  await snippetStore.getSnippetsById(storedSnippetId || firstSnippetId)
}

init()
</script>

<style scoped lang="scss">
.main {
  display: grid;
  height: 100vh;
  background-color: var(--color-bg);
  overflow: hidden;
  grid-template-columns: var(--sidebar-width) var(--snippets-list-width) 1fr;
}
.update-available {
  position: absolute;
  top: 2px;
  right: var(--spacing-xs);
  font-size: var(--text-xs);
  text-transform: uppercase;
  font-weight: 500;
  color: var(--color-text);
  &:hover {
    text-decoration: underline;
  }
  z-index: 1020;
}
</style>
