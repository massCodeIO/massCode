<script setup lang="ts">
import type { DialogOptions } from '~/main/types/ipc'
import type {
  SnippetsCountsResponse,
  VaultDoctorResponse,
} from '~/renderer/services/api/generated'
import { Badge } from '@/components/ui/shadcn/badge'
import { Button } from '@/components/ui/shadcn/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/shadcn/radio-group'
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
import { AlertTriangle, Check, LoaderCircle } from 'lucide-vue-next'
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
const vaultDoctorDecisionByGroupId = reactive<Record<string, string>>({})
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

const vaultDoctorDuplicateGroups = computed(() => {
  return (
    vaultDoctorReport.value?.conflictGroups.filter(
      group => group.reason === 'duplicate-id',
    ) ?? []
  )
})

const vaultDoctorSelectedDecisionCount = computed(() => {
  return vaultDoctorDuplicateGroups.value.filter(
    group => !!vaultDoctorDecisionByGroupId[group.id],
  ).length
})

const vaultDoctorWarningPreview = computed(() => {
  return vaultDoctorReport.value?.warnings.slice(0, 5) ?? []
})

const vaultDoctorHiddenWarningCount = computed(() => {
  const warningsCount = vaultDoctorReport.value?.warnings.length ?? 0
  return Math.max(0, warningsCount - vaultDoctorWarningPreview.value.length)
})

const vaultDoctorCanApply = computed(() => {
  return (
    vaultDoctorSafeFixesCount.value > 0
    || vaultDoctorSelectedDecisionCount.value > 0
  )
})

function resetVaultDoctorDecisions() {
  Object.keys(vaultDoctorDecisionByGroupId).forEach((groupId) => {
    delete vaultDoctorDecisionByGroupId[groupId]
  })
}

// Эвристика конфликтных копий cloud-sync: Dropbox "(conflicted copy)",
// Яндекс.Диск / macOS "— копия", generic "copy". Используется только для
// визуальной подсказки и предвыбора canonical, не влияет на backend.
const VAULT_DOCTOR_COPY_RE = /(?:—|-)\s*копия|\bкопия\b|\bcopy\b|conflict/i

function selectVaultDoctorDecision(groupId: string, keepPath: string) {
  vaultDoctorDecisionByGroupId[groupId] = keepPath
}

function isVaultDoctorDecisionSelected(groupId: string, path: string): boolean {
  return vaultDoctorDecisionByGroupId[groupId] === path
}

function splitVaultDoctorPath(value: string): { dir: string, name: string } {
  const index = value.lastIndexOf('/')
  if (index === -1) {
    return { dir: '', name: value }
  }

  return { dir: value.slice(0, index + 1), name: value.slice(index + 1) }
}

function isVaultDoctorCopyPath(path: string): boolean {
  return VAULT_DOCTOR_COPY_RE.test(splitVaultDoctorPath(path).name)
}

// Рекомендуемый canonical: первый файл без признаков копии, иначе самый
// короткий по имени (вероятный оригинал), иначе первый в группе.
function getVaultDoctorCanonicalPath(
  group: VaultDoctorResponse['conflictGroups'][number],
): string {
  const original = group.items.find(
    item => !isVaultDoctorCopyPath(item.path),
  )
  if (original) {
    return original.path
  }

  return (
    [...group.items].sort(
      (a, b) =>
        splitVaultDoctorPath(a.path).name.length
        - splitVaultDoctorPath(b.path).name.length,
    )[0]?.path ?? group.items[0]?.path
  )
}

function preselectVaultDoctorDecisions(report: VaultDoctorResponse) {
  report.conflictGroups
    .filter(group => group.reason === 'duplicate-id')
    .forEach((group) => {
      vaultDoctorDecisionByGroupId[group.id]
        = getVaultDoctorCanonicalPath(group)
    })
}

function getVaultDoctorDecisionReassignCount(
  group: VaultDoctorResponse['conflictGroups'][number],
): number {
  return vaultDoctorDecisionByGroupId[group.id] ? group.items.length - 1 : 0
}

function getVaultDoctorConflictId(
  group: VaultDoctorResponse['conflictGroups'][number],
): string {
  return group.id.split(':').at(-1) ?? group.id
}

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
    resetVaultDoctorDecisions()
    preselectVaultDoctorDecisions(data)
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
    || !vaultDoctorCanApply.value
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
    const decisions = Object.entries(vaultDoctorDecisionByGroupId).map(
      ([groupId, keepPath]) => ({ groupId, keepPath }),
    )
    const { data } = await api.system.postSystemVaultDoctorApply({
      decisions,
    })
    const appliedCount = data.items.filter(
      item => item.status === 'applied',
    ).length

    resetVaultDoctorDecisions()
    vaultDoctorReport.value = data
    await resetAndReloadVaultData()

    sonner({
      message: i18n.t('messages:success.vaultDoctorApplied', {
        count: appliedCount,
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
                || !vaultDoctorCanApply
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
                class="border-border overflow-hidden rounded-md border"
              >
                <div
                  class="border-border bg-background flex flex-wrap items-center justify-between gap-2 border-b p-2"
                >
                  <div class="flex min-w-0 items-center gap-2">
                    <AlertTriangle class="text-muted-foreground h-4 w-4" />
                    <UiText variant="sm">
                      {{ i18n.t("preferences:storage.vaultDoctor.conflicts") }}
                    </UiText>
                  </div>

                  <UiText
                    v-if="vaultDoctorDuplicateGroups.length"
                    variant="caption"
                    class="text-muted-foreground"
                  >
                    {{
                      i18n.t(
                        "preferences:storage.vaultDoctor.decisions.progress",
                        {
                          selected: vaultDoctorSelectedDecisionCount,
                          total: vaultDoctorDuplicateGroups.length,
                        },
                      )
                    }}
                  </UiText>
                </div>

                <div class="max-h-80 space-y-2 overflow-y-auto p-2 pr-1">
                  <div
                    v-for="group in vaultDoctorReport.conflictGroups"
                    :key="group.id"
                    class="border-border bg-muted/20 space-y-2 rounded-md border p-2"
                  >
                    <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Check
                        v-if="
                          group.reason === 'duplicate-id'
                            && vaultDoctorDecisionByGroupId[group.id]
                        "
                        class="h-4 w-4 shrink-0 text-emerald-500"
                      />
                      <AlertTriangle
                        v-else
                        class="text-muted-foreground h-4 w-4 shrink-0"
                      />

                      <UiText
                        v-if="group.reason === 'duplicate-id'"
                        variant="caption"
                      >
                        {{
                          i18n.t(
                            "preferences:storage.vaultDoctor.decisions.duplicateId",
                            { id: getVaultDoctorConflictId(group) },
                          )
                        }}
                      </UiText>
                      <UiText
                        v-else
                        variant="caption"
                      >
                        {{
                          i18n.t(
                            `preferences:storage.vaultDoctor.reason.${group.reason}`,
                          )
                        }}
                      </UiText>

                      <UiText
                        variant="caption"
                        class="text-muted-foreground"
                      >
                        {{
                          i18n.t(
                            "preferences:storage.vaultDoctor.decisions.files",
                            { count: group.items.length },
                          )
                        }}
                      </UiText>
                    </div>

                    <!-- Дубли id: выбор canonical через radio-group -->
                    <div
                      v-if="group.reason === 'duplicate-id'"
                      class="space-y-2"
                    >
                      <UiText
                        variant="caption"
                        class="text-muted-foreground block"
                      >
                        {{
                          i18n.t(
                            "preferences:storage.vaultDoctor.decisions.choose",
                            {
                              count: getVaultDoctorDecisionReassignCount(group),
                            },
                          )
                        }}
                      </UiText>

                      <RadioGroup
                        :model-value="vaultDoctorDecisionByGroupId[group.id]"
                        class="max-h-48 gap-1.5 overflow-y-auto pr-1"
                        @update:model-value="
                          (value) =>
                            selectVaultDoctorDecision(group.id, String(value))
                        "
                      >
                        <label
                          v-for="item in group.items"
                          :key="item.path"
                          class="hover:bg-accent/50 flex cursor-pointer items-center gap-3 rounded-md border p-2 transition-colors"
                          :class="
                            isVaultDoctorDecisionSelected(group.id, item.path)
                              ? 'border-primary bg-primary/5'
                              : 'border-border'
                          "
                        >
                          <RadioGroupItem :value="item.path" />

                          <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-2">
                              <UiText
                                variant="sm"
                                class="truncate"
                                :title="item.path"
                              >
                                {{ splitVaultDoctorPath(item.path).name }}
                              </UiText>
                              <Badge
                                v-if="!isVaultDoctorCopyPath(item.path)"
                                variant="secondary"
                              >
                                {{
                                  i18n.t(
                                    "preferences:storage.vaultDoctor.decisions.original",
                                  )
                                }}
                              </Badge>
                              <Badge
                                v-else
                                variant="outline"
                              >
                                {{
                                  i18n.t(
                                    "preferences:storage.vaultDoctor.decisions.copy",
                                  )
                                }}
                              </Badge>
                            </div>
                            <UiText
                              v-if="splitVaultDoctorPath(item.path).dir"
                              variant="caption"
                              class="text-muted-foreground block truncate"
                              :title="item.path"
                            >
                              {{ splitVaultDoctorPath(item.path).dir }}
                            </UiText>
                          </div>

                          <UiText
                            variant="caption"
                            class="shrink-0"
                            :class="
                              isVaultDoctorDecisionSelected(group.id, item.path)
                                ? 'text-primary'
                                : 'text-muted-foreground'
                            "
                          >
                            {{
                              isVaultDoctorDecisionSelected(group.id, item.path)
                                ? i18n.t(
                                  "preferences:storage.vaultDoctor.decisions.keepsId",
                                  { id: getVaultDoctorConflictId(group) },
                                )
                                : i18n.t(
                                  "preferences:storage.vaultDoctor.decisions.newId",
                                )
                            }}
                          </UiText>
                        </label>
                      </RadioGroup>
                    </div>

                    <!-- Заблокированные файлы (merge markers / битый frontmatter) -->
                    <UiText
                      v-else
                      variant="caption"
                      class="text-muted-foreground block font-mono break-all"
                    >
                      {{ group.items.map((item) => item.path).join(", ") }}
                    </UiText>
                  </div>
                </div>
              </div>

              <div
                v-if="vaultDoctorReport.warnings.length"
                class="border-border space-y-1 rounded-md border p-2"
              >
                <UiText variant="sm">
                  {{ i18n.t("preferences:storage.vaultDoctor.warnings") }}
                </UiText>
                <UiText
                  v-for="warning in vaultDoctorWarningPreview"
                  :key="`${warning.space}:${warning.path}:${warning.code}`"
                  variant="caption"
                  class="block font-mono break-all"
                >
                  {{ warning.code }} · {{ warning.path }}
                </UiText>
                <UiText
                  v-if="vaultDoctorHiddenWarningCount > 0"
                  variant="caption"
                  class="text-muted-foreground block"
                >
                  {{
                    i18n.t("preferences:storage.vaultDoctor.moreWarnings", {
                      count: vaultDoctorHiddenWarningCount,
                    })
                  }}
                </UiText>
              </div>
            </div>
          </div>
        </template>
      </UiMenuFormItem>
    </UiMenuFormSection>
  </div>
</template>
