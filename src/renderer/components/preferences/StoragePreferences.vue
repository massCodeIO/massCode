<template>
  <div class="storage">
    <AppForm>
      <AppFormItem :label="i18n.t('preferences:storage.label')">
        <AppInput
          v-model="storagePath"
          style="width: 100%"
          readonly
        />
        <template #actions>
          <AppButton @click="onClickMove">
            {{ i18n.t('button.moveStorage') }}
          </AppButton>
          <AppButton @click="onClickOpen">
            {{ i18n.t('button.openStorage') }}
          </AppButton>
          <AppButton @click="onClickNew">
            {{ i18n.t('button.newStorage') }}
          </AppButton>
          <AppButton @click="onClickReload">
            {{ i18n.t('button.reloadStorage') }}
          </AppButton>
        </template>
        <template #desc>
          {{ i18n.t('special:description.storage') }}
        </template>
      </AppFormItem>
      <AppFormItem :label="i18n.t('preferences:storage.migrate')">
        <AppButton @click="onClickMigrate">
          {{ i18n.t('button.fromMassCodeV1') }}
        </AppButton>
        <AppButton @click="onClickMigrateFromSnippetsLab">
          {{ i18n.t('button.fromSnippetsLab') }}
        </AppButton>
        <template #desc>
          {{ i18n.t('special:description.migrate.1') }}
          <p>{{ i18n.t('special:description.migrate.2') }}</p>
          <p>
            {{ i18n.t('special:description.migrate.3.0') }} <br>
            - {{ i18n.t('special:description.migrate.3.1') }}<br>
            - {{ i18n.t('special:description.migrate.3.2') }}
          </p>
        </template>
      </AppFormItem>
      <AppFormItem :label="i18n.t('preferences:storage.count')">
        {{ snippetStore.all.length }}
        {{ i18n.t('snippet.plural').toLowerCase() }}.
      </AppFormItem>
    </AppForm>
  </div>
</template>

<script setup lang="ts">
import { ipc, store, db, i18n } from '@/electron'
import { track } from '@/services/analytics'
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
    const message = i18n.t('special:error.folderNotContainDb')
    ipc.invoke('main:notification', {
      body: message
    })
    console.error(message)
  }
}

const onClickNew = async () => {
  const path = await ipc.invoke<any, string>('main:open-dialog', {})

  const isExist = db.isExist(path)

  if (!isExist) {
    store.preferences.set('storagePath', path)
    setStorageAndRestartApi(path, true)
    db.create()
    track('app/new-storage')
  } else {
    await ipc.invoke<MessageBoxRequest, boolean>('main:open-message-box', {
      message: i18n.t('special:error.folderContainDb'),
      detail: i18n.t('dialog:createDb'),
      buttons: [i18n.t('button.ok')]
    })
  }
}

const onClickMigrate = async () => {
  const state = await ipc.invoke<MessageBoxRequest, boolean>(
    'main:open-message-box',
    {
      message: i18n.t('dialog:migrateConfirm.0', { name: 'v1' }),
      detail: i18n.t('dialog:migrateConfirm.1'),
      buttons: [i18n.t('button.confirm'), i18n.t('button.cancel')]
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
      body: i18n.t('special:success.migrate')
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
      message: i18n.t('dialog:migrateConfirm.0', { name: 'SnippetsLab' }),
      detail: i18n.t('dialog:migrateConfirm.1'),
      buttons: [i18n.t('button.confirm'), i18n.t('button.cancel')]
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
      body: i18n.t('special:success.migrate')
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

const onClickReload = () => {
  ipc.invoke('main:restart-api', {})
  snippetStore.getSnippets()
}
</script>

<style lang="scss" scoped></style>
