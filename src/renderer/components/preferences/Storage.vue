<script setup lang="ts">
import type { DialogOptions } from '~/main/types/ipc'
import { useDialog } from '@/composables'
import { i18n, ipc, store } from '@/electron'

const storagePath = ref(store.preferences.get('storagePath'))

async function moveStorage() {
  const result = await ipc.invoke<DialogOptions, string>(
    'main-menu:open-dialog',
    {
      properties: ['openDirectory'],
    },
  )

  if (result) {
    ipc.invoke('db:move', result)
    storagePath.value = result
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
    storagePath.value = result
    ipc.invoke('db:relaod', result)
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
    ipc.invoke('db:migrate', result)
  }
}

async function clearDatabase() {
  const { confirm } = useDialog()

  const isConfirmed = await confirm({
    title: i18n.t('dialog:clearDbConfirm'),
    content: i18n.t('dialog:noUndo'),
  })

  if (isConfirmed) {
    ipc.invoke('db:clear', null)
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
