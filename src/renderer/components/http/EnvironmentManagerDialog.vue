<script setup lang="ts">
import type { HttpEnvironment } from '@/composables'
import { Checkbox } from '@/components/ui/shadcn/checkbox'
import * as Dialog from '@/components/ui/shadcn/dialog'
import {
  useDialog,
  useHttpEnvironments,
  useHttpEnvironmentSecrets,
} from '@/composables'
import { i18n } from '@/electron'
import { useDebounceFn } from '@vueuse/core'
import { Eye, EyeOff, KeyRound, Plus, Trash2 } from 'lucide-vue-next'
import { HTTP_SECRET_MASK } from '~/shared/httpVariables'

interface VariableEntry {
  /**
   * Стабильный идентификатор строки. Черновики значений привязаны к нему, а
   * не к имени переменной: пока пользователь набирает имя нового секрета,
   * привязка по имени создавала бы секрет на каждый промежуточный вариант.
   */
  uid: string
  key: string
  value: string
  secret?: boolean
  /** Секрет ещё не создан в main: имя можно менять, значение обязательно. */
  isNew?: boolean
}

const AUTO_SAVE_DEBOUNCE_MS = 500

const open = defineModel<boolean>('open', { required: true })

const VARIABLE_COLUMNS = [
  {
    key: 'key',
    label: i18n.t('spaces.http.environments.varKey'),
    placeholder: i18n.t('spaces.http.environments.varKey'),
  },
  {
    key: 'value',
    label: i18n.t('spaces.http.environments.varValue'),
    placeholder: i18n.t('spaces.http.environments.varValue'),
  },
  {
    key: 'secret',
    label: i18n.t('spaces.http.environments.varSecret'),
  },
]

const {
  environments,
  activeEnvironmentId,
  createHttpEnvironment,
  deleteHttpEnvironment,
  getHttpEnvironments,
  updateHttpEnvironment,
} = useHttpEnvironments()
const {
  deleteSecret,
  isSecretsEncryptionAvailable,
  refreshSecretsStatus,
  revealSecret,
  setSecret,
} = useHttpEnvironmentSecrets()
const { confirm } = useDialog()

const selectedEnvId = ref<number | null>(null)
const localName = ref('')
const localVariables = ref<VariableEntry[]>([])
// Новые значения секретов, ожидающие записи, и точечно раскрытые значения,
// в разрезе uid строки. В localVariables значения секретов не хранятся: они
// приходят из main только по явному запросу.
const secretDrafts = ref<Record<string, string>>({})
const revealedSecrets = ref<Record<string, string>>({})
let isSyncing = false
let uidCounter = 0

function nextUid(): string {
  uidCounter += 1
  return `variable-${uidCounter}`
}

const selectedEnv = computed<HttpEnvironment | null>(
  () =>
    environments.value.find(env => env.id === selectedEnvId.value) ?? null,
)

const variablesRecord = computed<Record<string, string>>(() => {
  const record: Record<string, string> = {}
  for (const entry of localVariables.value) {
    // Значения секретов живут вне vault и сохраняются отдельным вызовом.
    if (entry.key && !entry.secret) {
      record[entry.key] = entry.value
    }
  }
  return record
})

const missingSecretKeys = computed(
  () => new Set(selectedEnv.value?.missingSecretKeys ?? []),
)

const isDirty = computed(() => {
  const env = selectedEnv.value
  if (!env)
    return false
  if (env.name !== localName.value)
    return true
  if (Object.keys(secretDrafts.value).length > 0)
    return true
  if (JSON.stringify(env.variables) !== JSON.stringify(variablesRecord.value)) {
    return true
  }
  return false
})

/**
 * `keepPendingNew` сохраняет недозаполненные строки нового секрета вместе с их
 * черновиками: пересинхронизация из-за действия на соседней строке не должна
 * молча стирать уже набранный пользователем ввод.
 */
function syncLocalFromEnv(
  env: HttpEnvironment | null,
  options: { keepPendingNew?: boolean } = {},
) {
  const pendingNew
    = env && options.keepPendingNew
      ? localVariables.value.filter(
          entry => entry.isNew && !env.secretKeys.includes(entry.key.trim()),
        )
      : []
  const pendingDrafts: Record<string, string> = {}
  for (const entry of pendingNew) {
    const draft = secretDrafts.value[entry.uid]
    if (draft !== undefined)
      pendingDrafts[entry.uid] = draft
  }

  isSyncing = true
  secretDrafts.value = pendingDrafts
  revealedSecrets.value = {}
  if (!env) {
    localName.value = ''
    localVariables.value = []
  }
  else {
    localName.value = env.name
    localVariables.value = [
      ...Object.entries(env.variables).map(([key, value]) => ({
        key,
        uid: nextUid(),
        value,
      })),
      ...env.secretKeys.map(key => ({
        key,
        secret: true,
        uid: nextUid(),
        value: '',
      })),
      ...pendingNew,
    ]
  }
  nextTick(() => {
    isSyncing = false
  })
}

watch(selectedEnvId, () => {
  syncLocalFromEnv(selectedEnv.value)
})

watch(open, async (isOpen) => {
  if (!isOpen) {
    await flushPendingUpdate()
    return
  }
  await Promise.all([getHttpEnvironments(), refreshSecretsStatus()])
  const stillExists
    = selectedEnvId.value !== null
      && environments.value.some(env => env.id === selectedEnvId.value)
  if (stillExists) {
    syncLocalFromEnv(selectedEnv.value)
    return
  }
  const nextId = activeEnvironmentId.value ?? environments.value[0]?.id ?? null
  if (selectedEnvId.value === nextId) {
    syncLocalFromEnv(selectedEnv.value)
  }
  else {
    selectedEnvId.value = nextId
  }
})

/**
 * Значения секретов пишутся отдельным IPC-вызовом, а не вместе с variables:
 * в vault они не должны попадать ни на мгновение. Черновик очищается только
 * после успешной записи, иначе введённое значение исчезло бы молча.
 */
async function flushSecretDrafts() {
  const env = selectedEnv.value
  if (!env || Object.keys(secretDrafts.value).length === 0)
    return

  let hasSavedSecret = false

  for (const entry of localVariables.value) {
    const draft = secretDrafts.value[entry.uid]
    const key = entry.key.trim()
    if (!entry.secret || draft === undefined || !key)
      continue

    const isSaved = await setSecret(env.id, key, draft)
    if (isSaved) {
      delete secretDrafts.value[entry.uid]
      hasSavedSecret = true
    }
  }

  if (hasSavedSecret) {
    await getHttpEnvironments()
  }
}

async function flushUpdate() {
  const env = selectedEnv.value
  if (!env || !isDirty.value)
    return

  const payload: { name?: string, variables?: Record<string, string> } = {}
  const trimmedName = localName.value.trim()
  if (trimmedName && trimmedName !== env.name)
    payload.name = trimmedName
  if (JSON.stringify(env.variables) !== JSON.stringify(variablesRecord.value)) {
    payload.variables = variablesRecord.value
  }
  if (!payload.name && !payload.variables)
    return
  await updateHttpEnvironment(env.id, payload)
}

// Автосохранение намеренно не трогает секреты: пока пользователь набирает
// имя нового секрета, каждое срабатывание debounce создавало бы отдельный
// секрет под промежуточным именем.
const debouncedUpdate = useDebounceFn(flushUpdate, AUTO_SAVE_DEBOUNCE_MS)

async function flushPendingUpdate() {
  if (!selectedEnv.value || !isDirty.value)
    return

  await flushSecretDrafts()
  await flushUpdate()
}

watch(
  [localName, () => variablesRecord.value],
  () => {
    if (isSyncing)
      return
    if (!isDirty.value)
      return
    void debouncedUpdate()
  },
  { deep: true },
)

function getNextUntitledName(): string {
  const base = i18n.t('spaces.http.environments.untitled')
  const existing = new Set(
    environments.value.map(env => env.name.trim().toLowerCase()),
  )
  if (!existing.has(base.toLowerCase()))
    return base
  let index = 2
  while (existing.has(`${base} ${index}`.toLowerCase())) index += 1
  return `${base} ${index}`
}

function hasVariableContent(variable: VariableEntry): boolean {
  return Boolean(
    variable.secret || variable.key.trim() || variable.value.trim(),
  )
}

function isUntitledEnvironmentName(name: string): boolean {
  const base = i18n.t('spaces.http.environments.untitled')
  return name === base || name.startsWith(`${base} `)
}

function isEnvironmentEmpty(): boolean {
  const name = localName.value.trim()
  return (
    (!name || isUntitledEnvironmentName(name))
    && !localVariables.value.some(hasVariableContent)
  )
}

async function onAddEnvironment() {
  await flushPendingUpdate()
  const name = getNextUntitledName()
  const id = await createHttpEnvironment({ name })
  if (id)
    selectedEnvId.value = id
}

async function onDeleteEnvironment() {
  const env = selectedEnv.value
  if (!env)
    return

  if (!isEnvironmentEmpty()) {
    const isConfirmed = await confirm({
      title: i18n.t('messages:confirm.delete', {
        name: localName.value.trim() || env.name,
      }),
      content: i18n.t('messages:warning.noUndo'),
    })

    if (!isConfirmed)
      return
  }

  await deleteHttpEnvironment(env.id)
  selectedEnvId.value = environments.value[0]?.id ?? null
}

function createVariable(): VariableEntry {
  return { key: '', secret: false, uid: nextUid(), value: '' }
}

/**
 * Секрет заводится отдельной строкой, а не переключением уже введённой
 * переменной: иначе автосохранение успело бы записать значение в vault до
 * того, как пользователь отметит его секретным.
 */
function addSecretVariable() {
  localVariables.value.push({
    isNew: true,
    key: '',
    secret: true,
    uid: nextUid(),
    value: '',
  })
}

async function confirmRemoveVariable(variable: VariableEntry) {
  if (hasVariableContent(variable)) {
    const key = variable.key.trim()
    const isConfirmed = await confirm({
      title: key
        ? i18n.t('messages:confirm.deleteVariable', { name: key })
        : i18n.t('messages:confirm.deleteUnnamedVariable'),
      content: i18n.t('messages:warning.noUndo'),
    })

    if (!isConfirmed)
      return false
  }

  const env = selectedEnv.value
  delete secretDrafts.value[variable.uid]
  delete revealedSecrets.value[variable.uid]

  if (variable.secret && !variable.isNew && env) {
    await deleteSecret(env.id, variable.key)
  }

  return true
}

function getSecretValue(entry: VariableEntry): string {
  return (
    secretDrafts.value[entry.uid] ?? revealedSecrets.value[entry.uid] ?? ''
  )
}

function setSecretValue(entry: VariableEntry, value: string) {
  secretDrafts.value[entry.uid] = value
}

function getSecretPlaceholder(entry: VariableEntry): string {
  if (secretDrafts.value[entry.uid] !== undefined)
    return HTTP_SECRET_MASK

  if (entry.isNew)
    return i18n.t('spaces.http.environments.varValue')

  return missingSecretKeys.value.has(entry.key)
    ? i18n.t('spaces.http.environments.secretNotSet')
    : HTTP_SECRET_MASK
}

async function onToggleReveal(entry: VariableEntry) {
  const env = selectedEnv.value
  if (!env || entry.isNew)
    return

  if (revealedSecrets.value[entry.uid] !== undefined) {
    delete revealedSecrets.value[entry.uid]
    return
  }

  const value = await revealSecret(env.id, entry.key)
  if (value !== null) {
    revealedSecrets.value[entry.uid] = value
  }
}

async function onUnprotectSecret(index: number) {
  const env = selectedEnv.value
  const entry = localVariables.value[index]
  if (!env || !entry?.secret)
    return

  const key = entry.key.trim()
  if (entry.isNew || !key) {
    localVariables.value.splice(index, 1, {
      ...entry,
      isNew: false,
      secret: false,
      value: '',
    })
    delete secretDrafts.value[entry.uid]
    return
  }

  const isConfirmed = await confirm({
    title: i18n.t('messages:confirm.unprotectHttpSecret', { name: key }),
    content: i18n.t('messages:warning.httpSecretToPlainText'),
  })
  if (!isConfirmed)
    return

  // Незаписанные правки соседних переменных сохраняются до пересинхронизации.
  await flushPendingUpdate()

  // Значение переносится в обычную переменную: пользователь осознанно
  // отказался от защиты, а молча терять то, что больше негде взять, хуже.
  const revealedValue = await revealSecret(env.id, key)
  // `null` означает и ошибку IPC, и невозможность расшифровать. Переносить
  // нечего, поэтому секрет не удаляем: иначе значение пропало бы целиком.
  // Об ошибке пользователю уже сообщил сам revealSecret.
  if (revealedValue === null)
    return

  if (!(await deleteSecret(env.id, key)))
    return

  await getHttpEnvironments()
  // Операция асинхронная, за это время пользователь мог начать заполнять новый
  // секрет: пересборка без `keepPendingNew` потеряла бы его ввод.
  syncLocalFromEnv(selectedEnv.value, { keepPendingNew: true })
  localVariables.value.push({
    key,
    secret: false,
    uid: nextUid(),
    value: revealedValue,
  })
  await flushUpdate()
}

async function onSecretValueBlur(entry: VariableEntry) {
  if (secretDrafts.value[entry.uid] === undefined || !entry.key.trim())
    return

  await flushPendingUpdate()
  // Новая строка после записи становится обычным секретом: имя фиксируется,
  // значение больше не показывается.
  if (entry.isNew) {
    // Blur асинхронный: пока он длится, click по «Add secret» уже мог добавить
    // следующую пустую строку. Без `keepPendingNew` пересборка стёрла бы её
    // вместе с набранным вводом и фокусом.
    syncLocalFromEnv(selectedEnv.value, { keepPendingNew: true })
  }
}

/**
 * Существующую обычную переменную можно защитить: её значение уже лежит в
 * vault, и перевод в секрет как раз убирает его оттуда.
 */
async function onToggleSecret(index: number) {
  const env = selectedEnv.value
  const entry = localVariables.value[index]
  if (!env || !entry)
    return

  if (entry.secret) {
    await onUnprotectSecret(index)
    return
  }

  const key = entry.key.trim()
  if (!key || !isSecretsEncryptionAvailable.value)
    return

  const value = entry.value
  // Строка помечается секретной сразу, чтобы чекбокс не «отставал». Plain
  // значение из vault удаляет сам main внутри set-secret и только после
  // успешного шифрования, поэтому предварительный flush здесь не нужен.
  localVariables.value.splice(index, 1, { ...entry, secret: true, value: '' })

  const isSaved = await setSecret(env.id, key, value)
  if (!isSaved) {
    // Возвращаем прежнее состояние вместе со значением: после неудачной
    // записи взять его больше неоткуда.
    const currentIndex = localVariables.value.findIndex(
      item => item.uid === entry.uid,
    )
    if (currentIndex !== -1) {
      localVariables.value.splice(currentIndex, 1, {
        ...entry,
        secret: false,
        value,
      })
    }
    return
  }

  // Незаписанные правки остальных строк сохраняем до пересинхронизации,
  // иначе syncLocalFromEnv затрёт их данными из vault.
  await flushPendingUpdate()
  await getHttpEnvironments()
  syncLocalFromEnv(selectedEnv.value, { keepPendingNew: true })
}

async function onSelectEnvironment(id: number) {
  if (selectedEnvId.value === id)
    return
  await flushPendingUpdate()
  selectedEnvId.value = id
}
</script>

<template>
  <Dialog.Dialog v-model:open="open">
    <Dialog.DialogContent
      class="grid-rows-[auto_minmax(0,1fr)] overflow-hidden sm:max-w-3xl"
      @open-auto-focus="(e) => e.preventDefault()"
      @close-auto-focus="(e) => e.preventDefault()"
    >
      <Dialog.DialogHeader>
        <Dialog.DialogTitle>
          {{ i18n.t("spaces.http.environments.title") }}
        </Dialog.DialogTitle>
      </Dialog.DialogHeader>
      <div
        class="grid h-[min(560px,calc(100vh-8rem))] min-h-0 grid-cols-[200px_minmax(0,1fr)] gap-4"
      >
        <div class="border-border flex flex-col rounded border">
          <div
            class="border-border flex items-center justify-between border-b px-2 py-1"
          >
            <span class="text-muted-foreground text-xs font-medium">
              {{ i18n.t("spaces.http.environments.title") }}
            </span>
            <UiActionButton
              :tooltip="i18n.t('spaces.http.action.newEnvironment')"
              @click="onAddEnvironment"
            >
              <Plus class="size-3.5" />
            </UiActionButton>
          </div>
          <div class="scrollbar min-h-0 flex-1 overflow-y-auto p-1">
            <div
              v-if="environments.length === 0"
              class="text-muted-foreground px-2 py-2 text-xs"
            >
              {{ i18n.t("spaces.http.environments.empty") }}
            </div>
            <button
              v-for="env in environments"
              :key="env.id"
              type="button"
              class="flex h-[21px] w-full items-center rounded-md px-2 text-left text-sm"
              :class="
                selectedEnvId === env.id ? 'bg-accent' : 'hover:bg-accent-hover'
              "
              @click="onSelectEnvironment(env.id)"
            >
              <span class="truncate">{{ env.name }}</span>
            </button>
          </div>
        </div>

        <div
          v-if="!selectedEnv"
          class="text-muted-foreground flex items-center justify-center text-sm"
        >
          {{ i18n.t("spaces.http.environments.noEnvironmentSelected") }}
        </div>
        <div
          v-else
          class="flex min-h-0 min-w-0 flex-col gap-3"
        >
          <UiInput
            v-model="localName"
            variant="default"
            :placeholder="i18n.t('spaces.http.environments.namePlaceholder')"
          />
          <div
            class="border-border flex min-h-0 flex-1 flex-col rounded border"
          >
            <HttpKeyValueTable
              v-model="localVariables"
              :columns="VARIABLE_COLUMNS"
              :show-enabled="false"
              actions="delete"
              grid-template-columns="1fr 1fr 56px 24px"
              :create-entry="createVariable"
              :before-remove="confirmRemoveVariable"
              :empty-text="i18n.t('spaces.http.environments.noVariables')"
              :add-label="i18n.t('spaces.http.environments.addVariable')"
            >
              <template #cell-key="{ entry }">
                <UiInput
                  v-model="entry.key"
                  class="!h-6"
                  variant="ghost"
                  :disabled="entry.secret && !entry.isNew"
                  :title="
                    entry.secret && !entry.isNew
                      ? i18n.t('spaces.http.environments.secretKeyLocked')
                      : undefined
                  "
                  :placeholder="i18n.t('spaces.http.environments.varKey')"
                />
              </template>

              <template #cell-value="{ entry }">
                <UiInput
                  v-if="!entry.secret"
                  v-model="entry.value"
                  class="!h-6"
                  variant="ghost"
                  :placeholder="i18n.t('spaces.http.environments.varValue')"
                />
                <div
                  v-else
                  class="flex min-w-0 items-center gap-1"
                >
                  <UiInput
                    :model-value="getSecretValue(entry)"
                    class="!h-6"
                    variant="ghost"
                    :type="
                      revealedSecrets[entry.uid] !== undefined
                        ? 'text'
                        : 'password'
                    "
                    :placeholder="getSecretPlaceholder(entry)"
                    @update:model-value="
                      (value) => setSecretValue(entry, String(value))
                    "
                    @blur="onSecretValueBlur(entry)"
                  />
                  <UiActionButton
                    v-if="!entry.isNew"
                    :tooltip="
                      revealedSecrets[entry.uid] !== undefined
                        ? i18n.t('spaces.http.environments.hideSecret')
                        : i18n.t('spaces.http.environments.revealSecret')
                    "
                    @click="onToggleReveal(entry)"
                  >
                    <EyeOff
                      v-if="revealedSecrets[entry.uid] !== undefined"
                      class="size-3.5"
                    />
                    <Eye
                      v-else
                      class="size-3.5"
                    />
                  </UiActionButton>
                </div>
              </template>

              <template #cell-secret="{ entry, index }">
                <div
                  class="flex items-center justify-center"
                  :title="
                    isSecretsEncryptionAvailable
                      ? i18n.t('spaces.http.environments.secretHint')
                      : i18n.t('spaces.http.environments.secretUnavailable')
                  "
                >
                  <Checkbox
                    :model-value="Boolean(entry.secret)"
                    :disabled="
                      !entry.key.trim()
                        || (!entry.secret && !isSecretsEncryptionAvailable)
                    "
                    @update:model-value="() => onToggleSecret(index)"
                  />
                </div>
              </template>
            </HttpKeyValueTable>
          </div>
          <div class="flex items-center justify-between">
            <button
              type="button"
              class="text-muted-foreground hover:text-foreground inline-flex h-7 items-center gap-1 rounded px-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!isSecretsEncryptionAvailable"
              :title="
                isSecretsEncryptionAvailable
                  ? i18n.t('spaces.http.environments.secretHint')
                  : i18n.t('spaces.http.environments.secretUnavailable')
              "
              @click="addSecretVariable"
            >
              <KeyRound class="size-3.5" />
              {{ i18n.t("spaces.http.environments.addSecret") }}
            </button>
            <button
              type="button"
              class="text-destructive hover:bg-destructive/10 inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs"
              @click="onDeleteEnvironment"
            >
              <Trash2 class="size-3.5" />
              {{ i18n.t("spaces.http.action.deleteEnvironment") }}
            </button>
          </div>
        </div>
      </div>
    </Dialog.DialogContent>
  </Dialog.Dialog>
</template>
