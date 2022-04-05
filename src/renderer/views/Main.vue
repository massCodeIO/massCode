<template>
  <div class="main">
    <TheSidebar />
    <SnippetList />
    <SnippetsView />
    <button
      style="position: absolute; bottom: 30px; right: 30px; z-index: 100"
      @click="onMigrate"
    >
      migrate
    </button>
  </div>
</template>

<script setup lang="ts">
import { store, db, ipc } from '@/electron'
import router from '@/router'
import { useFolderStore } from '@/store/folders'
import { useSnippetStore } from '@/store/snippets'
import { onMounted } from 'vue'

const onMigrate = () => {
  db.migrate(store.preferences.get('storagePath'))
  ipc.invoke('restart', null)
}

const folderStore = useFolderStore()
const snippetStore = useSnippetStore()

const init = async () => {
  const storedFolderId = store.app.get('selectedFolderId')
  const storedFolderAlias = store.app.get('selectedFolderAlias')
  const storedSnippetId = store.app.get('selectedSnippetId')

  await folderStore.getFolders()
  await snippetStore.getSnippets()

  if (storedSnippetId) {
    snippetStore.setSnippetById(storedSnippetId)
  }

  if (storedFolderId) {
    folderStore.selectId(storedFolderId)
    await snippetStore.setSnippetsByFolderIds()
  }

  if (storedFolderAlias) {
    snippetStore.setSnippetsByAlias(storedFolderAlias)
  }
}

const addDevtoolsHost = () => {
  if (import.meta.env.DEV) {
    const s = document.createElement('script')
    s.src = 'http://localhost:8098'
    document.head.appendChild(s)
  }
}

addDevtoolsHost()
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
