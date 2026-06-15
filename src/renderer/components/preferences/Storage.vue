<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import type { DialogOptions } from '~/main/types/ipc'
import type { SnippetsCountsResponse } from '~/renderer/services/api/generated'
import { Badge } from '@/components/ui/shadcn/badge'
import { Button } from '@/components/ui/shadcn/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/shadcn/radio-group'
import {
  resetHttpSpaceState,
  resetNotesSpaceInitialization,
  useDialog,
  useDrawings,
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
  useVaultDoctor,
  VAULT_DOCTOR_NOTICE_ID,
} from '@/composables'
import { i18n, ipc, store } from '@/electron'
import { AlertTriangle, Check, LoaderCircle } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import { api } from '~/renderer/services/api'

interface DirectoryStateResponse {
  exists: boolean
  isEmpty: boolean
}

interface MoveVaultResponse {
  vaultPath: string
}

const { sonner, dismiss } = useSonner()
const { confirm } = useDialog()
const { getFolders } = useFolders()
const { getHttpFolders } = useHttpFolders()
const { getHttpRequests } = useHttpRequests()
const { getHttpEnvironments } = useHttpEnvironments()
const { getHttpHistory } = useHttpHistory()
const { reset: resetMathNotebook } = useMathNotebook()
const { resetDrawings } = useDrawings()
const { resetNoteFoldersState } = useNoteFolders()
const { clearNotesState, getNotes } = useNotes()
const { resetNoteTags } = useNoteTags()
const { getSnippets } = useSnippets()
const route = useRoute()
const router = useRouter()
const vaultDoctorSection
  = useTemplateRef<ComponentPublicInstance>('vaultDoctorSection')

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
const isVaultDoctorScanLoaderVisible = ref(false)
const isVaultDoctorApplyLoaderVisible = ref(false)
let loadingCountsTimer: ReturnType<typeof setTimeout> | null = null
let vaultDoctorScanLoaderTimer: ReturnType<typeof setTimeout> | null = null
let vaultDoctorApplyLoaderTimer: ReturnType<typeof setTimeout> | null = null

const {
  report: vaultDoctorReport,
  decisionByGroupId: vaultDoctorDecisionByGroupId,
  isScanning: isVaultDoctorScanning,
  isApplying: isVaultDoctorApplying,
  hasReport: vaultDoctorHasReport,
  safeFixesCount: vaultDoctorSafeFixesCount,
  blockedCount: vaultDoctorBlockedCount,
  conflictCount: vaultDoctorConflictCount,
  duplicateGroups: vaultDoctorDuplicateGroups,
  selectedDecisionCount: vaultDoctorSelectedDecisionCount,
  warningPreview: vaultDoctorWarningPreview,
  hiddenWarningCount: vaultDoctorHiddenWarningCount,
  canApply: vaultDoctorCanApply,
  splitPath: splitVaultDoctorPath,
  isCopyPath: isVaultDoctorCopyPath,
  getConflictId: getVaultDoctorConflictId,
  getDecisionReassignCount: getVaultDoctorDecisionReassignCount,
  selectDecision: selectVaultDoctorDecision,
  isDecisionSelected: isVaultDoctorDecisionSelected,
  scan: scanVault,
  apply: applyVault,
  reset: resetVaultDoctor,
} = useVaultDoctor()

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

// Отложенный лоадер скана: показываем спиннер только если скан длится дольше
// порога, иначе быстрый скан вызвал бы мелькание лоадера на долю секунды.
function showVaultDoctorScanLoader() {
  vaultDoctorScanLoaderTimer = setTimeout(() => {
    isVaultDoctorScanLoaderVisible.value = true
  }, 300)
}

function hideVaultDoctorScanLoader() {
  if (vaultDoctorScanLoaderTimer) {
    clearTimeout(vaultDoctorScanLoaderTimer)
    vaultDoctorScanLoaderTimer = null
  }

  isVaultDoctorScanLoaderVisible.value = false
}

// Тот же отложенный лоадер для apply, чтобы быстрый apply не мигал спиннером.
function showVaultDoctorApplyLoader() {
  vaultDoctorApplyLoaderTimer = setTimeout(() => {
    isVaultDoctorApplyLoaderVisible.value = true
  }, 300)
}

function hideVaultDoctorApplyLoader() {
  if (vaultDoctorApplyLoaderTimer) {
    clearTimeout(vaultDoctorApplyLoaderTimer)
    vaultDoctorApplyLoaderTimer = null
  }

  isVaultDoctorApplyLoaderVisible.value = false
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
  resetDrawings()
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

  await refreshVaultDoctorAfterVaultChange()
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

    // Контент тот же, но путь сменился — прежний отчёт по старым путям неактуален.
    dismiss(VAULT_DOCTOR_NOTICE_ID)
    resetVaultDoctor()

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
  showVaultDoctorScanLoader()

  try {
    const data = await scanVault()

    if (
      data
      && data.summary.affectedFiles === 0
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
    hideVaultDoctorScanLoader()
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

  showVaultDoctorApplyLoader()

  try {
    const data = await applyVault()
    const appliedCount = data.items.filter(
      item => item.status === 'applied',
    ).length

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
    hideVaultDoctorApplyLoader()
  }
}

function scrollToVaultDoctorSection() {
  nextTick(() => {
    vaultDoctorSection.value?.$el?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  })
}

// Смена vault делает прежний отчёт неактуальным (он про другой путь). Сбрасываем
// и пере-сканируем новый vault. Сканируем тихо (без sonner): мы уже в Storage,
// секция сама покажет результат, а при конфликтах подсвечиваем её скроллом.
async function refreshVaultDoctorAfterVaultChange() {
  // Убираем уведомление о конфликтах прежнего vault — оно больше не актуально.
  dismiss(VAULT_DOCTOR_NOTICE_ID)
  resetVaultDoctor()
  showVaultDoctorScanLoader()

  try {
    await scanVault()

    if (vaultDoctorConflictCount.value > 0) {
      scrollToVaultDoctorSection()
    }
  }
  catch {
    // Vault уже загружен; провал health-чека не критичен и не требует sonner.
  }
  finally {
    hideVaultDoctorScanLoader()
  }
}

// Переход из startup-уведомления о конфликтах: переиспользуем отчёт
// startup-проверки (если он есть), иначе сканируем, и скроллим к секции,
// чтобы пользователь не искал её вручную. Query чистим, чтобы повторный
// заход не триггерил автоповедение.
onMounted(() => {
  if (route.query.doctor !== 'scan') {
    return
  }

  router.replace({ query: {} })

  if (!vaultDoctorReport.value) {
    scanVaultDoctor()
  }

  scrollToVaultDoctorSection()
})
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

    <UiMenuFormSection
      ref="vaultDoctorSection"
      :label="i18n.t('preferences:storage.vaultDoctor.label')"
    >
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
              v-if="isVaultDoctorScanLoaderVisible"
              class="mr-2 h-4 w-4 animate-spin"
            />
            {{
              isVaultDoctorScanLoaderVisible
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
              v-if="isVaultDoctorApplyLoaderVisible"
              class="mr-2 h-4 w-4 animate-spin"
            />
            {{
              isVaultDoctorApplyLoaderVisible
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
                class="border-border bg-background overflow-hidden rounded-md border"
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
                            variant="sm"
                            class="shrink-0"
                            :class="
                              isVaultDoctorDecisionSelected(group.id, item.path)
                                ? 'text-foreground'
                                : 'text-muted-foreground'
                            "
                          >
                            {{
                              isVaultDoctorDecisionSelected(group.id, item.path)
                                ? i18n.t(
                                  "preferences:storage.vaultDoctor.decisions.keepsId",
                                  {
                                    id: `:${getVaultDoctorConflictId(group)}`,
                                  },
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
