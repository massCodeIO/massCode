<script setup lang="ts">
import type { Backup } from '~/main/db/types'
import type { DialogOptions } from '~/main/types/ipc'
import type { SnippetsCountsResponse } from '~/renderer/services/api/generated'
import * as Select from '@/components/ui/shadcn/select'
import { Switch } from '@/components/ui/shadcn/switch'
import { useDialog, useSonner } from '@/composables'
import { i18n, ipc, store } from '@/electron'
import { format } from 'date-fns'
import { RotateCcw, Trash2 } from 'lucide-vue-next'
import { api } from '~/renderer/services/api'
import { preferencesKeys } from './keys'

const { sonner } = useSonner()
const { scrollRef } = inject(preferencesKeys)!

const storagePath = ref(store.preferences.get('storagePath'))
const backupSettings = reactive(store.preferences.get('backup'))
const backups = ref<Backup[]>([])

const isShowBackupList = ref(false)
const isRestoringBackup = ref(false)

const backupItervalOptions = [
  { label: i18n.t('preferences:storage.backup.interval.1'), value: 1 },
  { label: i18n.t('preferences:storage.backup.interval.6'), value: 6 },
  { label: i18n.t('preferences:storage.backup.interval.12'), value: 12 },
  { label: i18n.t('preferences:storage.backup.interval.24'), value: 24 },
]

const backupMaxBackupsOptions = [
  { label: '5', value: 5 },
  { label: '10', value: 10 },
  { label: '15', value: 15 },
  { label: '20', value: 20 },
]

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

async function createBackup() {
  await ipc.invoke('db:backup', true)
  sonner({
    message: i18n.t('messages:success.backup.created'),
    type: 'success',
  })

  if (isShowBackupList.value) {
    await showBackupList()
    nextTick(() => {
      scrollRef.value?.ps?.update()
    })
  }
}

async function restoreBackup(backupPath: string) {
  const { confirm } = useDialog()

  const isConfirmed = await confirm({
    title: i18n.t('messages:confirm.backup.restore'),
    content: i18n.t('messages:warning.noUndo'),
  })

  if (!isConfirmed)
    return

  isRestoringBackup.value = true

  try {
    await ipc.invoke('db:restore', backupPath)
    sonner({
      message: i18n.t('messages:success.backup.restored'),
      type: 'success',
    })
    await getSnippetsCounts()
  }
  catch (err) {
    const e = err as Error
    sonner({ message: e.message, type: 'error' })
  }
  finally {
    isRestoringBackup.value = false
  }
}

async function deleteBackup(backupPath: string) {
  const { confirm } = useDialog()

  const isConfirmed = await confirm({
    title: i18n.t('messages:confirm.backup.delete'),
    content: i18n.t('messages:warning.noUndo'),
  })

  if (!isConfirmed)
    return

  await ipc.invoke('db:delete-backup', backupPath)
  await showBackupList()
  sonner({
    message: i18n.t('messages:success.backup.deleted'),
    type: 'success',
  })

  nextTick(() => {
    scrollRef.value?.ps?.update()
  })
}

async function moveBackupStorage() {
  const result = await ipc.invoke<DialogOptions, string>(
    'main-menu:open-dialog',
    {
      properties: ['openDirectory', 'createDirectory'],
    },
  )

  if (result) {
    await ipc.invoke('db:move-backup', result)
    sonner({
      message: i18n.t('messages:success.backup.moved'),
      type: 'success',
    })
  }
}

async function openBackupStorage() {
  const result = await ipc.invoke<DialogOptions, string>(
    'main-menu:open-dialog',
    {
      properties: ['openDirectory'],
    },
  )

  if (result) {
    backupSettings.path = result
    store.preferences.set('backup', JSON.parse(JSON.stringify(backupSettings)))
  }

  if (isShowBackupList.value) {
    await showBackupList()
    nextTick(() => {
      scrollRef.value?.ps?.update()
    })
  }
}

async function showBackupList() {
  backups.value = (await ipc.invoke('db:backup-list', null)) as Backup[]
  isShowBackupList.value = true
}

function onBackupIntervalChange(value: string) {
  backupSettings.interval = Number.parseInt(value)
  ipc.invoke('db:stop-auto-backup', null)
  ipc.invoke('db:start-auto-backup', null)
}

function formatFileSize(bytes: number) {
  if (bytes === 0)
    return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
}

function isManualBackup(backup: Backup) {
  return backup.name.startsWith('massCode-manual-backup-')
}

function hideBackupList() {
  isShowBackupList.value = false
  nextTick(() => {
    scrollRef.value?.ps?.update()
  })
}

watch(
  backupSettings,
  () => {
    store.preferences.set('backup', JSON.parse(JSON.stringify(backupSettings)))
  },
  { deep: true },
)
</script>

<template>
  <div class="space-y-5">
    <UiMenuFormSection :label="i18n.t('preferences:storage.section.main')">
      <UiMenuFormItem :label="i18n.t('path')">
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
        {{ i18n.t("total") }}: {{ counts.total }},
        {{ i18n.t("sidebar.trash") }}:
        {{ counts.trash }}
      </UiMenuFormItem>
    </UiMenuFormSection>
    <UiMenuFormSection :label="i18n.t('preferences:storage.backup.label')">
      <UiMenuFormItem :label="i18n.t('path')">
        <UiInput
          v-model="backupSettings.path"
          disabled
          size="sm"
        />
        <template #actions>
          <div class="flex gap-2">
            <UiButton
              size="md"
              @click="moveBackupStorage"
            >
              {{ i18n.t("action.move.storage") }}
            </UiButton>
            <UiButton
              size="md"
              @click="openBackupStorage"
            >
              {{ i18n.t("action.open.storage") }}
            </UiButton>
          </div>
        </template>
      </UiMenuFormItem>
      <UiMenuFormItem :label="i18n.t('preferences:storage.backup.enabled')">
        <Switch
          :checked="backupSettings.enabled"
          @update:checked="backupSettings.enabled = $event"
        />
      </UiMenuFormItem>
      <UiMenuFormItem
        :label="i18n.t('preferences:storage.backup.interval.label')"
      >
        <Select.Select
          :model-value="backupSettings.interval.toString()"
          @update:model-value="onBackupIntervalChange"
        >
          <Select.SelectTrigger class="w-64">
            <Select.SelectValue />
          </Select.SelectTrigger>
          <Select.SelectContent>
            <Select.SelectItem
              v-for="option in backupItervalOptions"
              :key="option.value"
              :value="option.value.toString()"
            >
              {{ option.label }}
            </Select.SelectItem>
          </Select.SelectContent>
        </Select.Select>
      </UiMenuFormItem>
      <UiMenuFormItem :label="i18n.t('preferences:storage.backup.maxBackups')">
        <Select.Select
          :model-value="backupSettings.maxBackups.toString()"
          @update:model-value="
            backupSettings.maxBackups = Number.parseInt($event)
          "
        >
          <Select.SelectTrigger class="w-64">
            <Select.SelectValue />
          </Select.SelectTrigger>
          <Select.SelectContent>
            <Select.SelectItem
              v-for="option in backupMaxBackupsOptions"
              :key="option.value"
              :value="option.value.toString()"
            >
              {{ option.label }}
            </Select.SelectItem>
          </Select.SelectContent>
        </Select.Select>
        <template #description>
          {{ i18n.t("messages:description.backup.manual") }}
        </template>
      </UiMenuFormItem>
      <UiMenuFormItem :label="i18n.t('preferences:storage.backup.createNow')">
        <UiButton
          size="md"
          @click="createBackup"
        >
          {{ i18n.t("action.backup.create") }}
        </UiButton>
      </UiMenuFormItem>
      <UiMenuFormItem :label="i18n.t('preferences:storage.backup.list')">
        <div class="flex gap-2">
          <UiButton
            size="md"
            @click="showBackupList"
          >
            {{ i18n.t("action.backup.showList") }}
          </UiButton>
          <UiButton
            v-if="isShowBackupList"
            size="md"
            @click="hideBackupList"
          >
            {{ i18n.t("action.hide") }}
          </UiButton>
        </div>
        <div
          v-if="isShowBackupList"
          class="space-y-2"
        >
          <div
            v-for="backup in backups"
            :key="backup.path"
            class="border-border flex items-center justify-between rounded-lg border p-3"
          >
            <div class="flex-1">
              <div class="text-sm font-medium tabular-nums">
                {{ format(backup.createdAt, "dd.MM.yyyy HH:mm:ss") }} •
                {{ formatFileSize(backup.size) }}
                {{ isManualBackup(backup) ? "(manual)" : "" }}
              </div>
            </div>

            <UiActionButton
              :tooltip="i18n.t('action.delete.common')"
              @click="deleteBackup(backup.path)"
            >
              <Trash2 class="h-3 w-3 text-red-500" />
            </UiActionButton>
            <UiActionButton
              :tooltip="i18n.t('action.backup.restore')"
              :disabled="isRestoringBackup"
              @click="restoreBackup(backup.path)"
            >
              <RotateCcw class="h-3 w-3" />
            </UiActionButton>
            <!-- <UiButton
              size="sm"

              :disabled="isRestoringBackup"
              @click="restoreBackup(backup.path)"
            >
              {{ i18n.t('action.backup.restore') }}
            </UiButton> -->
          </div>
        </div>
      </UiMenuFormItem>
    </UiMenuFormSection>
  </div>
</template>
