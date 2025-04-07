<script setup lang="ts">
import type { DialogOptions } from '~/main/types/ipc'
import type { SnippetsCountsResponse } from '~/renderer/services/api/generated'
import { useDialog, useSonner } from '@/composables'
import { i18n, ipc, store } from '@/electron'
import { api } from '~/renderer/services/api'

const storagePath = ref(store.preferences.get('storagePath'))

const { sonner } = useSonner()

const counts = reactive<SnippetsCountsResponse>({
  total: 0,
  trash: 0,
})

async function getSnippetsCounts() {
  try {
    const { data } = await api.snippets.getSnippetsCounts()

    counts.total = data.total
    counts.trash = data.trash
  }
  catch (err) {
    console.error(err)
  }
}

getSnippetsCounts()

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
      await getSnippetsCounts()
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
    title: i18n.t('messages:confirm.migrateDb.0'),
    content: i18n.t('messages:confirm.migrateDb.1'),
  })

  if (isConfirmed) {
    try {
      await ipc.invoke('db:migrate', result)
      await getSnippetsCounts()
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
    title: i18n.t('messages:confirm.clearDb'),
    content: i18n.t('messages:warning.noUndo'),
  })

  if (isConfirmed) {
    try {
      await ipc.invoke('db:clear', null)
      await getSnippetsCounts()
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
            {{ i18n.t("action.move.storage") }}
          </UiButton>
          <UiButton
            size="md"
            @click="openStorage"
          >
            {{ i18n.t("action.open.storage") }}
          </UiButton>
        </div>
      </template>
      <template #description>
        {{ i18n.t("messages:description.storage") }}
      </template>
    </UiMenuFormItem>
    <UiMenuFormItem :label="i18n.t('preferences:storage.migrate')">
      <UiButton
        size="md"
        @click="migrateFromV3"
      >
        {{ i18n.t("action.migrate.fromV3") }}
      </UiButton>
      <template #description>
        {{ i18n.t("messages:description.migrate.fromV3") }}
      </template>
    </UiMenuFormItem>
    <UiMenuFormItem :label="i18n.t('preferences:storage.clearDatabase')">
      <UiButton
        size="md"
        variant="danger"
        @click="clearDatabase"
      >
        {{ i18n.t("action.delete.allData") }}
      </UiButton>
      <template #description>
        {{ i18n.t("messages:warning.clearDb") }}
      </template>
    </UiMenuFormItem>
    <UiMenuFormItem :label="i18n.t('preferences:storage.count')">
      {{ i18n.t("total") }}: {{ counts.total }}, {{ i18n.t("sidebar.trash") }}:
      {{ counts.trash }}
    </UiMenuFormItem>
  </div>
</template>
