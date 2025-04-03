<script setup lang="ts">
import type { DialogOptions } from '~/main/types/ipc'
import { useDialog, useSonner } from '@/composables'
import { i18n, ipc, store } from '@/electron'

const storagePath = ref(store.preferences.get('storagePath'))

const { sonner } = useSonner()

async function moveStorage() {
  const result = await ipc.invoke<DialogOptions, string>(
    'main-menu:open-dialog',
    {
      properties: ['openDirectory'],
    },
  )

  if (result) {
    try {
      await ipc.invoke('db:move', result)
      storagePath.value = result
      sonner({ message: 'Storage successfully moved', type: 'success' })
    }
    catch (err) {
      const e = err as Error
      sonner({ message: e.message, type: 'error' })
    }
  }
}

async function openStorage() {
  const result = await ipc.invoke<DialogOptions, string>(
    'main-menu:open-dialog',
    {
      properties: ['openDirectory'],
    },
  )

  if (result) {
    try {
      await ipc.invoke('db:relaod', result)
      storagePath.value = result
      sonner({ message: 'Database successfully loaded', type: 'success' })
    }
    catch (err) {
      const e = err as Error
      sonner({ message: e.message, type: 'error' })
    }
  }
}

async function migrateFromV3() {
  const result = await ipc.invoke<DialogOptions, string>(
    'main-menu:open-dialog',
    {
      properties: ['openFile'],
      filters: [{ name: '*', extensions: ['json'] }],
    },
  )

  const { confirm } = useDialog()

  if (!result) {
    return
  }

  const isConfirmed = await confirm({
    title: i18n.t('dialog:migrateConfirm.0'),
    content: i18n.t('dialog:migrateConfirm.1'),
  })

  if (isConfirmed) {
    try {
      await ipc.invoke('db:migrate', result)
      sonner({ message: 'Migration successfully completed', type: 'success' })
    }
    catch (err) {
      const e = err as Error
      sonner({ message: e.message, type: 'error' })
    }
  }
}

async function clearDatabase() {
  const { confirm } = useDialog()

  const isConfirmed = await confirm({
    title: i18n.t('dialog:clearDbConfirm'),
    content: i18n.t('dialog:noUndo'),
  })

  if (isConfirmed) {
    try {
      await ipc.invoke('db:clear', null)
      sonner({ message: 'Database successfully cleared', type: 'success' })
    }
    catch (err) {
      const e = err as Error
      sonner({ message: e.message, type: 'error' })
    }
  }
}
</script>

<template>
  <div class="space-y-5">
    <UiMenuFormItem :label="i18n.t('preferences:storage.label')">
      <UiInput
        v-model="storagePath"
        disabled
        size="sm"
      />
      <template #actions>
        <div class="flex gap-2">
          <UiButton
            size="md"
            @click="moveStorage"
          >
            {{ i18n.t("button.moveStorage") }}
          </UiButton>
          <UiButton
            size="md"
            @click="openStorage"
          >
            {{ i18n.t("button.openStorage") }}
          </UiButton>
        </div>
      </template>
      <template #description>
        {{ i18n.t("special:description.storage") }}
      </template>
    </UiMenuFormItem>
    <UiMenuFormItem :label="i18n.t('preferences:storage.migrate')">
      <UiButton
        size="md"
        @click="migrateFromV3"
      >
        {{ i18n.t("button.migrateFromV3") }}
      </UiButton>
      <template #description>
        {{ i18n.t("special:description.migrate.1") }}
      </template>
    </UiMenuFormItem>
    <UiMenuFormItem :label="i18n.t('preferences:storage.clearDatabase')">
      <UiButton
        size="md"
        variant="danger"
        @click="clearDatabase"
      >
        {{ i18n.t("button.deleteAllData") }}
      </UiButton>
      <template #description>
        {{ i18n.t("special:description.clearDatabase") }}
      </template>
    </UiMenuFormItem>
  </div>
</template>
