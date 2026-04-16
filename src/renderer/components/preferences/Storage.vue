<script setup lang="ts">
import type { DialogOptions } from '~/main/types/ipc'
import type { SnippetsCountsResponse } from '~/renderer/services/api/generated'
import { Button } from '@/components/ui/shadcn/button'
import {
  resetNotesSpaceInitialization,
  useDialog,
  useFolders,
  useMathNotebook,
  useNoteFolders,
  useNotes,
  useNoteTags,
  useSnippets,
  useSonner,
} from '@/composables'
import { i18n, ipc, store } from '@/electron'
import { LoaderCircle } from 'lucide-vue-next'
import { api } from '~/renderer/services/api'

interface DirectoryStateResponse {
  exists: boolean
  isEmpty: boolean
}

interface MoveVaultResponse {
  vaultPath: string
}

const { sonner } = useSonner()
const { confirm } = useDialog()
const { getFolders } = useFolders()
const { reset: resetMathNotebook } = useMathNotebook()
const { resetNoteFoldersState } = useNoteFolders()
const { clearNotesState } = useNotes()
const { resetNoteTags } = useNoteTags()
const { getSnippets } = useSnippets()

function getDefaultVaultPath(baseStoragePath: string): string {
  const separator = baseStoragePath.includes('\\') ? '\\' : '/'
  const hasTrailingSeparator
    = baseStoragePath.endsWith('\\') || baseStoragePath.endsWith('/')

  return `${baseStoragePath}${hasTrailingSeparator ? '' : separator}markdown-vault`
}

const storagePath = ref<string>(
  store.preferences.get('storage.rootPath') as string,
)
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
const isMovingVault = ref(false)
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

async function resetAndReloadVaultData() {
  resetMathNotebook()
  clearNotesState()
  resetNoteFoldersState()
  resetNoteTags()
  resetNotesSpaceInitialization()

  await nextTick()

  await getFolders(false)
  await getSnippets()
  await getSnippetsCounts()
}

async function openVaultStorage() {
  if (isMovingVault.value) {
    return
  }

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
  await resetAndReloadVaultData()

  sonner({
    message: i18n.t('messages:success.vaultLoaded'),
    type: 'success',
  })
}

async function moveVaultStorage() {
  if (isMovingVault.value) {
    return
  }

  const targetPath = await ipc.invoke<DialogOptions, string>(
    'main-menu:open-dialog',
    {
      properties: ['openDirectory', 'createDirectory'],
    },
  )

  if (!targetPath) {
    return
  }

  const directoryState = await ipc.invoke<
    { path: string },
    DirectoryStateResponse
  >('system:get-directory-state', {
    path: targetPath,
  })

  if (!directoryState.isEmpty) {
    const isConfirmed = await confirm({
      title: i18n.t('messages:confirm.moveVaultOverwrite.0'),
      content: i18n.t('messages:confirm.moveVaultOverwrite.1'),
    })

    if (!isConfirmed) {
      return
    }
  }

  isMovingVault.value = true

  try {
    const result = await ipc.invoke<{ targetPath: string }, MoveVaultResponse>(
      'system:move-vault',
      { targetPath },
    )

    vaultPath.value = result.vaultPath
    await resetAndReloadVaultData()

    sonner({
      message: i18n.t('messages:success.vaultMoved'),
      type: 'success',
    })
  }
  catch (err) {
    const error = err as Error
    sonner({ message: error.message, type: 'error' })
  }
  finally {
    isMovingVault.value = false
  }
}

async function migrateSqliteToMarkdown() {
  if (isMovingVault.value) {
    return
  }

  const sqliteDbPath = await ipc.invoke<DialogOptions, string>(
    'main-menu:open-dialog',
    {
      properties: ['openFile'],
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
    },
  )

  if (!sqliteDbPath) {
    return
  }

  const isConfirmed = await confirm({
    title: i18n.t('messages:confirm.migrateToMarkdown.0'),
    content: i18n.t('messages:confirm.migrateToMarkdown.1'),
  })

  if (!isConfirmed) {
    return
  }

  try {
    const result = await ipc.invoke<
      string,
      { folders: number, snippets: number, tags: number }
    >('db:migrate-to-markdown', sqliteDbPath)

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
          <div class="flex flex-wrap gap-2">
            <Button
              variant="outline"
              :disabled="isMovingVault"
              @click="openVaultStorage"
            >
              {{ i18n.t("action.select.directory") }}
            </Button>

            <Button
              variant="outline"
              :disabled="isMovingVault"
              @click="moveVaultStorage"
            >
              <LoaderCircle
                v-if="isMovingVault"
                class="mr-2 h-4 w-4 animate-spin"
              />
              {{ i18n.t("preferences:storage.moveVault") }}
            </Button>
          </div>
        </template>

        <template #description>
          <div class="space-y-2">
            <div>
              {{ i18n.t("messages:description.storageVault") }}
            </div>

            <div
              v-if="isMovingVault"
              class="flex items-center gap-2"
            >
              <LoaderCircle class="h-4 w-4 animate-spin" />
              <span>{{ i18n.t("preferences:storage.movingVault") }}</span>
            </div>
          </div>
        </template>
      </UiMenuFormItem>

      <UiMenuFormItem :label="i18n.t('preferences:storage.count')">
        <LoaderCircle
          v-if="isLoadingCounts"
          class="h-4 w-4 animate-spin"
        />

        <template v-else>
          {{ i18n.t("common.total") }}: {{ counts.total }},
          {{ i18n.t("common.trash") }}: {{ counts.trash }}
        </template>
      </UiMenuFormItem>
    </UiMenuFormSection>

    <UiMenuFormSection :label="i18n.t('preferences:storage.section.migration')">
      <UiMenuFormItem
        :label="i18n.t('preferences:storage.migrateSqliteToMarkdown')"
      >
        <Button
          variant="outline"
          :disabled="isMovingVault"
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
