<script setup lang="ts">
import type { DialogOptions } from '~/main/types/ipc'
import type { SnippetsCountsResponse } from '~/renderer/services/api/generated'
import { Button } from '@/components/ui/shadcn/button'
import { useDialog, useFolders, useSnippets, useSonner } from '@/composables'
import { i18n, ipc, store } from '@/electron'
import { LoaderCircle } from 'lucide-vue-next'
import { api } from '~/renderer/services/api'

const { sonner } = useSonner()
const { confirm } = useDialog()
const { getFolders } = useFolders()
const { getSnippets } = useSnippets()

function getDefaultVaultPath(baseStoragePath: string): string {
  const separator = baseStoragePath.includes('\\') ? '\\' : '/'
  const hasTrailingSeparator
    = baseStoragePath.endsWith('\\') || baseStoragePath.endsWith('/')

  return `${baseStoragePath}${hasTrailingSeparator ? '' : separator}markdown-vault`
}

const storagePath = ref(store.preferences.get('storagePath'))
const vaultPath = ref<string | null>(
  (store.preferences.get('storage') as { vaultPath?: string | null })
    ?.vaultPath ?? null,
)

const effectiveVaultPath = computed(() => {
  if (vaultPath.value && vaultPath.value.trim()) {
    return vaultPath.value
  }

  return getDefaultVaultPath(storagePath.value)
})

const counts = reactive<SnippetsCountsResponse>({
  total: 0,
  trash: 0,
})
const isLoadingCounts = ref(false)
let loadingCountsTimer: ReturnType<typeof setTimeout> | null = null

function showLoadingCounts() {
  loadingCountsTimer = setTimeout(() => {
    isLoadingCounts.value = true
  }, 300)
}

function hideLoadingCounts() {
  if (loadingCountsTimer) {
    clearTimeout(loadingCountsTimer)
    loadingCountsTimer = null
  }

  isLoadingCounts.value = false
}

async function getSnippetsCounts() {
  showLoadingCounts()

  try {
    const { data } = await api.snippets.getSnippetsCounts()

    counts.total = data.total
    counts.trash = data.trash
  }
  catch (err) {
    console.error(err)
  }
  finally {
    hideLoadingCounts()
  }
}

getSnippetsCounts()

async function openVaultStorage() {
  const result = await ipc.invoke<DialogOptions, string>(
    'main-menu:open-dialog',
    {
      properties: ['openDirectory', 'createDirectory'],
    },
  )

  if (!result) {
    return
  }

  vaultPath.value = result
  store.preferences.set('storage.vaultPath', result)

  await nextTick()

  showLoadingCounts()

  try {
    await getFolders(false)
    await getSnippets()

    const { data } = await api.snippets.getSnippetsCounts()
    counts.total = data.total
    counts.trash = data.trash
  }
  finally {
    hideLoadingCounts()
  }

  sonner({
    message: i18n.t('messages:success.vaultLoaded'),
    type: 'success',
  })
}

async function migrateSqliteToMarkdown() {
  const isConfirmed = await confirm({
    title: i18n.t('messages:confirm.migrateToMarkdown.0'),
    content: i18n.t('messages:confirm.migrateToMarkdown.1'),
  })

  if (!isConfirmed) {
    return
  }

  try {
    const result = await ipc.invoke<
      undefined,
      { folders: number, snippets: number, tags: number }
    >('db:migrate-to-markdown', undefined)

    await getFolders(false)
    await getSnippets()
    await getSnippetsCounts()

    sonner({
      message: i18n.t('messages:success.migrateToMarkdown', {
        folders: result.folders,
        snippets: result.snippets,
        tags: result.tags,
      }),
      type: 'success',
    })
  }
  catch (err) {
    const error = err as Error
    sonner({ message: error.message, type: 'error' })
  }
}
</script>

<template>
  <div class="space-y-4">
    <UiMenuFormSection :label="i18n.t('preferences:storage.section.main')">
      <UiMenuFormItem :label="i18n.t('preferences:storage.vaultPath')">
        <UiInput
          :model-value="effectiveVaultPath"
          disabled
          size="sm"
        />

        <template #actions>
          <Button
            variant="outline"
            @click="openVaultStorage"
          >
            {{ i18n.t("action.select.directory") }}
          </Button>
        </template>

        <template #description>
          {{ i18n.t("messages:description.storageVault") }}
        </template>
      </UiMenuFormItem>

      <UiMenuFormItem :label="i18n.t('preferences:storage.count')">
        <LoaderCircle
          v-if="isLoadingCounts"
          class="h-4 w-4 animate-spin"
        />

        <template v-else>
          {{ i18n.t("total") }}: {{ counts.total }},
          {{ i18n.t("sidebar.trash") }}: {{ counts.trash }}
        </template>
      </UiMenuFormItem>
    </UiMenuFormSection>

    <UiMenuFormSection :label="i18n.t('preferences:storage.section.migration')">
      <UiMenuFormItem
        :label="i18n.t('preferences:storage.migrateSqliteToMarkdown')"
      >
        <Button
          variant="outline"
          @click="migrateSqliteToMarkdown"
        >
          {{ i18n.t("preferences:storage.migrateSqliteToMarkdown") }}
        </Button>

        <template #description>
          {{ i18n.t("messages:description.migrateSqliteUtility") }}
        </template>
      </UiMenuFormItem>
    </UiMenuFormSection>
  </div>
</template>
