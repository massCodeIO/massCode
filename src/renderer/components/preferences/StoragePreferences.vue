<template>
  <div class="storage">
    <AppForm>
      <AppFormItem label="Storage">
        <AppInput
          v-model="storagePath"
          readonly
        />
        <AppButton @click="onClickMove">
          Move Storage
        </AppButton>
        <AppButton @click="onClickOpen">
          Open Storage
        </AppButton>
        <template #desc>
          To use sync services like iCloud Drive, Google Drive of Dropbox,
          simply move storage to the corresponding synced folders
        </template>
      </AppFormItem>
      <AppFormItem label="Migrate">
        <AppButton @click="onClickMigrate">
          From massCode v1.0
        </AppButton>
        <AppButton @click="onClickMigrateFromSnippetsLab">
          From SnippetsLab
        </AppButton>
        <template #desc>
          To migrate from massCode v1.0 select the folder containing the
          database files.
          <p>To migrate from SnippetsLab select JSON file.</p>
          <p>
            Some Limitations. During migration from SnippetsLab, snippets with
            unsupported languages will be set to default Plain Text. Also since
            JSON file does not represent nesting for folders, all folders will
            be first level.
          </p>
        </template>
      </AppFormItem>
      <AppFormItem label="Count">
        {{ snippetStore.all.length }} snippets.
      </AppFormItem>
    </AppForm>
  </div>
</template>

<script setup lang="ts">
import { ipc, store, db, track } from '@/electron'
import { useFolderStore } from '@/store/folders'
import { useSnippetStore } from '@/store/snippets'
import type { MessageBoxRequest, DialogRequest } from '@shared/types/main'
import { ref } from 'vue'

const snippetStore = useSnippetStore()
const folderStore = useFolderStore()

const storagePath = ref(store.preferences.get('storagePath'))

const onClickMove = async () => {
  const path = await ipc.invoke<any, string>('main:open-dialog', {})

  if (!path) return

  try {
    await db.move(storagePath.value, path)
    console.log('aas')
    setStorageAndRestartApi(path)
    track('app/move-storage')
  } catch (err) {
    const e = err as Error
    ipc.invoke('main:notification', {
      body: e.message
    })
    console.error(err)
  }
}

const onClickOpen = async () => {
  const path = await ipc.invoke<any, string>('main:open-dialog', {})
  const isExist = db.isExist(path)

  if (isExist) {
    setStorageAndRestartApi(path, true)
    snippetStore.getSnippets()
    track('app/open-storage')
  } else {
    const message = 'Folder not contain "db.json".'
    ipc.invoke('main:notification', {
      body: message
    })
    console.error(message)
  }
}

const onClickMigrate = async () => {
  const state = await ipc.invoke<MessageBoxRequest, boolean>(
    'main:open-message-box',
    {
      message: 'Are you sure you want to migrate from v1',
      detail:
        'During migrate from old DB, the current library will be overwritten.',
      buttons: ['Confirm', 'Cancel']
    }
  )

  if (!state) return

  try {
    const path = await ipc.invoke<any, string>('main:open-dialog', {})

    if (!path) return

    await db.migrate(path)

    ipc.invoke('main:restart-api', {})

    resetStore()
    await snippetStore.getSnippets()

    ipc.invoke('main:notification', {
      body: 'DB successfully migrated.'
    })

    track('app/migrate')
  } catch (err) {
    const e = err as Error
    ipc.invoke('main:notification', {
      body: e.message
    })
    console.error(err)
  }
}

const onClickMigrateFromSnippetsLab = async () => {
  const state = await ipc.invoke<MessageBoxRequest, boolean>(
    'main:open-message-box',
    {
      message: 'Are you sure you want to migrate from SnippetsLab',
      detail: 'During migrate, the current library will be overwritten.',
      buttons: ['Confirm', 'Cancel']
    }
  )

  if (!state) return

  try {
    const path = await ipc.invoke<DialogRequest, string>('main:open-dialog', {
      properties: ['openFile']
    })

    if (!path) return

    db.migrateFromSnippetsLab(path)

    ipc.invoke('main:restart-api', {})

    resetStore()
    await snippetStore.getSnippets()

    ipc.invoke('main:notification', {
      body: 'DB successfully migrated.'
    })

    track('app/migrate', 'from-snippets-lab')
  } catch (err) {
    const e = err as Error
    ipc.invoke('main:notification', {
      body: e.message
    })
    console.error(err)
  }
}

const setStorageAndRestartApi = (path: string, reset?: boolean) => {
  storagePath.value = path
  store.preferences.set('storagePath', path)

  if (reset) resetStore()

  ipc.invoke('main:restart-api', {})
}

const resetStore = () => {
  store.app.delete('selectedFolderAlias')
  store.app.delete('selectedFolderId')
  store.app.delete('selectedFolderIds')
  store.app.delete('selectedSnippetId')

  snippetStore.$reset()
  folderStore.$reset()
}
</script>

<style lang="scss" scoped></style>
