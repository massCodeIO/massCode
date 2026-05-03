<script setup lang="ts">
import type { HttpEnvironment } from '@/composables'
import * as Dialog from '@/components/ui/shadcn/dialog'
import { useHttpEnvironments } from '@/composables'
import { i18n } from '@/electron'
import { useDebounceFn } from '@vueuse/core'
import { Plus, Trash2 } from 'lucide-vue-next'

interface VariableEntry {
  key: string
  value: string
}

const AUTO_SAVE_DEBOUNCE_MS = 500

const open = defineModel<boolean>('open', { required: true })

const {
  environments,
  activeEnvironmentId,
  createHttpEnvironment,
  deleteHttpEnvironment,
  getHttpEnvironments,
  updateHttpEnvironment,
} = useHttpEnvironments()

const selectedEnvId = ref<number | null>(null)
const localName = ref('')
const localVariables = ref<VariableEntry[]>([])
let isSyncing = false

const selectedEnv = computed<HttpEnvironment | null>(
  () =>
    environments.value.find(env => env.id === selectedEnvId.value) ?? null,
)

const variablesRecord = computed<Record<string, string>>(() => {
  const record: Record<string, string> = {}
  for (const entry of localVariables.value) {
    if (entry.key) {
      record[entry.key] = entry.value
    }
  }
  return record
})

const isDirty = computed(() => {
  const env = selectedEnv.value
  if (!env)
    return false
  if (env.name !== localName.value)
    return true
  if (JSON.stringify(env.variables) !== JSON.stringify(variablesRecord.value)) {
    return true
  }
  return false
})

function syncLocalFromEnv(env: HttpEnvironment | null) {
  isSyncing = true
  if (!env) {
    localName.value = ''
    localVariables.value = []
  }
  else {
    localName.value = env.name
    localVariables.value = Object.entries(env.variables).map(
      ([key, value]) => ({ key, value }),
    )
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
  await getHttpEnvironments()
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

const debouncedUpdate = useDebounceFn(flushUpdate, AUTO_SAVE_DEBOUNCE_MS)

async function flushPendingUpdate() {
  if (selectedEnv.value && isDirty.value) {
    await flushUpdate()
  }
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
  await deleteHttpEnvironment(env.id)
  selectedEnvId.value = environments.value[0]?.id ?? null
}

function addVariable() {
  localVariables.value.push({ key: '', value: '' })
}

function removeVariable(index: number) {
  localVariables.value.splice(index, 1)
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
            <div
              class="text-muted-foreground border-border grid grid-cols-[1fr_1fr_24px] items-center gap-2 border-b px-2 py-1.5 text-[10px] font-semibold tracking-wider uppercase"
            >
              <span>{{ i18n.t("spaces.http.environments.varKey") }}</span>
              <span>{{ i18n.t("spaces.http.environments.varValue") }}</span>
              <span />
            </div>
            <div class="scrollbar min-h-0 flex-1 overflow-y-auto">
              <div
                v-if="localVariables.length === 0"
                class="text-muted-foreground px-2 py-2 text-xs"
              >
                {{ i18n.t("spaces.http.environments.noVariables") }}
              </div>
              <div
                v-for="(entry, index) in localVariables"
                :key="index"
                class="border-border hover:bg-accent-hover grid grid-cols-[1fr_1fr_24px] items-center gap-2 border-b px-2 py-1 last:border-b-0"
              >
                <UiInput
                  v-model="entry.key"
                  class="!h-7 font-mono"
                  variant="ghost"
                  :placeholder="i18n.t('spaces.http.environments.varKey')"
                />
                <UiInput
                  v-model="entry.value"
                  class="!h-7 font-mono"
                  variant="ghost"
                  :placeholder="i18n.t('spaces.http.environments.varValue')"
                />
                <button
                  type="button"
                  class="text-muted-foreground hover:text-foreground hover:bg-accent inline-flex size-6 items-center justify-center rounded"
                  @click="removeVariable(index)"
                >
                  <Trash2 class="size-3.5" />
                </button>
              </div>
            </div>
            <button
              type="button"
              class="text-muted-foreground hover:text-foreground border-border inline-flex h-7 w-fit items-center gap-1 rounded px-2 text-xs"
              @click="addVariable"
            >
              <Plus class="size-3.5" />
              {{ i18n.t("spaces.http.environments.addVariable") }}
            </button>
          </div>
          <div class="flex justify-end">
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
