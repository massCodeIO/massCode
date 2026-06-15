<script setup lang="ts">
import type { DialogOptions } from '~/main/types/ipc'
import type {
  SnippetsCountsResponse,
  VaultDoctorResponse,
} from '~/renderer/services/api/generated'
import { Button } from '@/components/ui/shadcn/button'
import {
  resetHttpSpaceState,
  resetNotesSpaceInitialization,
  useDialog,
  useFolders,
  useHttpEnvironments,
  useHttpFolders,
  useHttpHistory,
  useHttpRequests,
  useMathNotebook,
  useNoteFolders,
  useNotes,
  useNoteTags,
  useSnippets,
  useSonner,
} from '@/composables'
import { i18n, ipc, store } from '@/electron'
import { AlertTriangle, LoaderCircle } from 'lucide-vue-next'
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
const { getHttpFolders } = useHttpFolders()
const { getHttpRequests } = useHttpRequests()
const { getHttpEnvironments } = useHttpEnvironments()
const { getHttpHistory } = useHttpHistory()
const { reset: resetMathNotebook } = useMathNotebook()
const { resetNoteFoldersState } = useNoteFolders()
const { clearNotesState, getNotes } = useNotes()
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
const isVaultDoctorApplying = ref(false)
const isVaultDoctorScanning = ref(false)
const vaultDoctorReport = shallowRef<VaultDoctorResponse | null>(null)
let loadingCountsTimer: ReturnType<typeof setTimeout> | null = null

const vaultDoctorSafeFixesCount = computed(() => {
  return (
    vaultDoctorReport.value?.items.filter(item => item.status === 'pending')
      .length ?? 0
  )
})

const vaultDoctorBlockedCount = computed(() => {
  return vaultDoctorReport.value?.summary.blocked ?? 0
})

const vaultDoctorConflictCount = computed(() => {
  return vaultDoctorReport.value?.summary.conflicts ?? 0
})

const vaultDoctorHasReport = computed(() => !!vaultDoctorReport.value)

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
  resetHttpSpaceState()

  await nextTick()

  await Promise.allSettled([
    getFolders(false),
    getSnippets(),
    getNotes(),
    getHttpFolders(false),
    getHttpRequests(),
    getHttpEnvironments(),
    getHttpHistory(),
  ])
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

async function scanVaultDoctor() {
  if (isVaultDoctorScanning.value || isVaultDoctorApplying.value) {
    return
  }

  isVaultDoctorScanning.value = true

  try {
    const { data } = await api.system.postSystemVaultDoctorPreview({})
    vaultDoctorReport.value = data

    if (
      data.summary.affectedFiles === 0
      && data.summary.conflicts === 0
      && data.summary.warnings === 0
    ) {
      sonner({
        message: i18n.t('messages:success.vaultDoctorClean'),
        type: 'success',
      })
    }
  }
  catch (err) {
    const error = err as Error
    sonner({ message: error.message, type: 'error' })
  }
  finally {
    isVaultDoctorScanning.value = false
  }
}

async function applyVaultDoctorSafeFixes() {
  if (
    isVaultDoctorApplying.value
    || isVaultDoctorScanning.value
    || vaultDoctorSafeFixesCount.value === 0
  ) {
    return
  }

  const isConfirmed = await confirm({
    title: i18n.t('messages:confirm.vaultDoctorApply.0'),
    content: i18n.t('messages:confirm.vaultDoctorApply.1'),
  })

  if (!isConfirmed) {
    return
  }

  isVaultDoctorApplying.value = true

  try {
    const { data } = await api.system.postSystemVaultDoctorApply({})
    vaultDoctorReport.value = data
    await resetAndReloadVaultData()

    sonner({
      message: i18n.t('messages:success.vaultDoctorApplied', {
        count: vaultDoctorSafeFixesCount.value,
      }),
      type: 'success',
    })
  }
  catch (err) {
    const error = err as Error
    sonner({ message: error.message, type: 'error' })
  }
  finally {
    isVaultDoctorApplying.value = false
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

    <UiMenuFormSection :label="i18n.t('preferences:storage.vaultDoctor.label')">
      <UiMenuFormItem
        :label="i18n.t('preferences:storage.vaultDoctor.scan.label')"
      >
        <div class="flex flex-wrap gap-2">
          <Button
            variant="outline"
            :disabled="isVaultDoctorScanning || isVaultDoctorApplying"
            @click="scanVaultDoctor"
          >
            <LoaderCircle
              v-if="isVaultDoctorScanning"
              class="mr-2 h-4 w-4 animate-spin"
            />
            {{
              isVaultDoctorScanning
                ? i18n.t("preferences:storage.vaultDoctor.scan.scanning")
                : i18n.t("preferences:storage.vaultDoctor.scan.action")
            }}
          </Button>

          <Button
            v-if="vaultDoctorHasReport"
            variant="outline"
            :disabled="
              isVaultDoctorScanning
                || isVaultDoctorApplying
                || vaultDoctorSafeFixesCount === 0
            "
            @click="applyVaultDoctorSafeFixes"
          >
            <LoaderCircle
              v-if="isVaultDoctorApplying"
              class="mr-2 h-4 w-4 animate-spin"
            />
            {{
              isVaultDoctorApplying
                ? i18n.t("preferences:storage.vaultDoctor.apply.applying")
                : i18n.t("preferences:storage.vaultDoctor.apply.action")
            }}
          </Button>
        </div>

        <template #description>
          <div class="space-y-3">
            <div>
              {{ i18n.t("preferences:storage.vaultDoctor.description") }}
            </div>

            <div
              v-if="vaultDoctorReport"
              class="space-y-2"
            >
              <div class="grid gap-2 sm:grid-cols-4">
                <div class="border-border space-y-1 rounded-md border p-2">
                  <UiText
                    variant="caption"
                    class="block"
                  >
                    {{ i18n.t("preferences:storage.vaultDoctor.summary.safe") }}
                  </UiText>
                  <UiText
                    variant="sm"
                    class="block"
                  >
                    {{ vaultDoctorSafeFixesCount }}
                  </UiText>
                </div>
                <div class="border-border space-y-1 rounded-md border p-2">
                  <UiText
                    variant="caption"
                    class="block"
                  >
                    {{
                      i18n.t(
                        "preferences:storage.vaultDoctor.summary.conflicts",
                      )
                    }}
                  </UiText>
                  <UiText
                    variant="sm"
                    class="block"
                  >
                    {{ vaultDoctorConflictCount }}
                  </UiText>
                </div>
                <div class="border-border space-y-1 rounded-md border p-2">
                  <UiText
                    variant="caption"
                    class="block"
                  >
                    {{
                      i18n.t("preferences:storage.vaultDoctor.summary.blocked")
                    }}
                  </UiText>
                  <UiText
                    variant="sm"
                    class="block"
                  >
                    {{ vaultDoctorBlockedCount }}
                  </UiText>
                </div>
                <div class="border-border space-y-1 rounded-md border p-2">
                  <UiText
                    variant="caption"
                    class="block"
                  >
                    {{
                      i18n.t("preferences:storage.vaultDoctor.summary.warnings")
                    }}
                  </UiText>
                  <UiText
                    variant="sm"
                    class="block"
                  >
                    {{ vaultDoctorReport.summary.warnings }}
                  </UiText>
                </div>
              </div>

              <div
                v-if="vaultDoctorReport.conflictGroups.length"
                class="border-border space-y-1 rounded-md border p-2"
              >
                <div class="flex items-center gap-2">
                  <AlertTriangle class="text-muted-foreground h-4 w-4" />
                  <UiText variant="sm">
                    {{ i18n.t("preferences:storage.vaultDoctor.conflicts") }}
                  </UiText>
                </div>

                <UiText
                  v-for="group in vaultDoctorReport.conflictGroups.slice(0, 3)"
                  :key="group.id"
                  variant="caption"
                  class="block font-mono"
                >
                  {{ group.reason }} ·
                  {{ group.items.map((item) => item.path).join(", ") }}
                </UiText>
              </div>

              <div
                v-if="vaultDoctorReport.warnings.length"
                class="border-border space-y-1 rounded-md border p-2"
              >
                <UiText variant="sm">
                  {{ i18n.t("preferences:storage.vaultDoctor.warnings") }}
                </UiText>
                <UiText
                  v-for="warning in vaultDoctorReport.warnings.slice(0, 3)"
                  :key="`${warning.space}:${warning.path}:${warning.code}`"
                  variant="caption"
                  class="block font-mono"
                >
                  {{ warning.code }} · {{ warning.path }}
                </UiText>
              </div>
            </div>
          </div>
        </template>
      </UiMenuFormItem>
    </UiMenuFormSection>
  </div>
</template>
