import type { HttpRequestItemResponse } from '@/services/api/generated'
import { markPersistedStorageMutation } from '@/composables/useStorageMutation'
import { api } from '@/services/api'
import {
  emptyHttpRuntime,
  httpExpectedSchema,
  httpOperatorNeedsExpected,
  httpRuntimeSchema,
} from '~/shared/httpRuntime'
import { httpRuntimeNavigation } from './runtimeNavigation'
import { useHttpRequests } from './useHttpRequests'

type Runtime = NonNullable<HttpRequestItemResponse['runtime']>
const draft = ref<Runtime>(emptyHttpRuntime())
const saved = ref(JSON.stringify(draft.value))
const saving = ref(false)
const savingRequest = ref(false)
const requestSaveError = ref(false)
const saveError = ref(false)
const conflict = ref(false)
const expectedInputs = ref<Record<number, string>>({})
const expectedErrors = ref<Record<number, boolean>>({})
type RuleGroup = 'extractions' | 'assertions'
type RuleField = 'name' | 'path' | 'expected'
type Rule = Runtime[RuleGroup][number]
const touched = ref(new Map<Rule, Set<RuleField>>())
const leaveDialogOpen = ref(false)
const focusTarget = ref<{
  group: RuleGroup
  index: number
  field: RuleField
} | null>(null)
let leavePromise: Promise<boolean> | null = null
let resolveLeave: ((allowed: boolean) => void) | null = null
const validation = computed(() => httpRuntimeSchema.safeParse(draft.value))
const fieldErrors = computed(() => {
  const errors: Record<string, string> = {}
  if (!validation.value.success) {
    for (const issue of validation.value.error.issues) {
      const path = issue.path.join('.')
      errors[path] ??= issue.code === 'custom' ? issue.message : 'invalid'
    }
  }
  for (const [index, invalid] of Object.entries(expectedErrors.value)) {
    if (
      invalid
      && httpOperatorNeedsExpected(
        draft.value.assertions[Number(index)]?.operator ?? 'exists',
      )
    ) {
      errors[`assertions.${index}.expected`] = 'expectedValue'
    }
  }
  return errors
})

function touchField(group: RuleGroup, index: number, field: RuleField) {
  const rule = draft.value[group][index]
  if (!rule)
    return
  const fields = touched.value.get(rule) ?? new Set<RuleField>()
  fields.add(field)
  touched.value.set(rule, fields)
}

function fieldError(group: RuleGroup, index: number, field: RuleField) {
  const rule = draft.value[group][index]
  if (!rule || !touched.value.get(rule)?.has(field))
    return undefined
  return fieldErrors.value[`${group}.${index}.${field}`]
}
let expectedRevision: string | null = null
const hasExpectedErrors = computed(() =>
  Object.entries(expectedErrors.value).some(
    ([index, invalid]) =>
      invalid
      && httpOperatorNeedsExpected(
        draft.value.assertions[Number(index)]?.operator ?? 'exists',
      ),
  ),
)
const dirty = computed(
  () => hasExpectedErrors.value || JSON.stringify(draft.value) !== saved.value,
)
const valid = computed(
  () => !hasExpectedErrors.value && validation.value.success,
)
const groupDirty = computed(() => {
  const baseline: Runtime = saved.value
    ? JSON.parse(saved.value)
    : emptyHttpRuntime()
  return {
    assertions:
      hasExpectedErrors.value
      || JSON.stringify(draft.value.assertions)
      !== JSON.stringify(baseline.assertions),
    extractions:
      JSON.stringify(draft.value.extractions)
      !== JSON.stringify(baseline.extractions),
  }
})
const groupInvalid = computed(() => ({
  assertions: Object.keys(fieldErrors.value).some(key =>
    key.startsWith('assertions.'),
  ),
  extractions: Object.keys(fieldErrors.value).some(key =>
    key.startsWith('extractions.'),
  ),
}))
const {
  currentRequest,
  isCurrentRequestDirty,
  saveCurrentRequest,
  discardCurrentRequestChanges,
} = useHttpRequests()
const requestDirty = computed(() => dirty.value || isCurrentRequestDirty.value)
const busy = computed(() => saving.value || savingRequest.value)
let owner: string | null = null
let generation = 0

watch(
  currentRequest,
  (request) => {
    const nextOwner = request ? `${request.id}:${request.createdAt}` : null
    if (nextOwner === owner && dirty.value)
      return
    if (nextOwner !== owner) {
      generation += 1
      focusTarget.value = null
    }
    if (nextOwner !== owner && resolveLeave)
      finishLeave(false)
    owner = nextOwner
    draft.value = structuredClone(request?.runtime ?? emptyHttpRuntime())
    saved.value = JSON.stringify(draft.value)
    expectedRevision = request?.runtimeRevision ?? null
    saveError.value = false
    requestSaveError.value = false
    conflict.value = false
    expectedInputs.value = {}
    expectedErrors.value = {}
    touched.value.clear()
  },
  { immediate: true, flush: 'sync' },
)

function setExpected(index: number, text: string | number) {
  expectedInputs.value[index] = String(text)
  try {
    const value = httpExpectedSchema.parse(JSON.parse(String(text)))
    draft.value.assertions[index]!.expected = value
    expectedErrors.value[index] = false
  }
  catch {
    expectedErrors.value[index] = true
  }
}

function removeAssertion(index: number) {
  const rule = draft.value.assertions[index]
  if (rule)
    touched.value.delete(rule)
  draft.value.assertions.splice(index, 1)
  // Keep raw inputs associated with their rule when row indices shift.
  const shift = <T>(entries: Record<number, T>) =>
    Object.fromEntries(
      Object.entries(entries)
        .filter(([key]) => Number(key) !== index)
        .map(([key, value]) => [
          Number(key) > index ? Number(key) - 1 : Number(key),
          value,
        ]),
    )
  expectedInputs.value = shift(expectedInputs.value)
  expectedErrors.value = shift(expectedErrors.value)
}

function removeExtraction(index: number) {
  const rule = draft.value.extractions[index]
  if (rule)
    touched.value.delete(rule)
  draft.value.extractions.splice(index, 1)
}

function validateRuntime(): boolean {
  for (const group of ['extractions', 'assertions'] as const) {
    draft.value[group].forEach((_, index) => {
      for (const field of ['name', 'path', 'expected'] as const)
        touchField(group, index, field)
    })
  }
  if (!valid.value) {
    const [group, index, field]
      = Object.keys(fieldErrors.value)[0]?.split('.') ?? []
    if (
      (group === 'assertions' || group === 'extractions')
      && index
      && (field === 'name' || field === 'path' || field === 'expected')
    ) {
      focusTarget.value = { group, index: Number(index), field }
    }
    return false
  }
  return true
}

async function saveRuntime(): Promise<boolean> {
  const request = currentRequest.value
  if (
    !request
    || request.runtimeState !== 'ready'
    || expectedRevision === null
    || saving.value
    || !validateRuntime()
  ) {
    return false
  }
  if (!dirty.value)
    return true
  const id = request.id
  const token = generation
  const snapshot = JSON.parse(JSON.stringify(draft.value)) as Runtime
  saving.value = true
  saveError.value = false
  conflict.value = false
  try {
    markPersistedStorageMutation()
    const { data } = await api.httpRequests.putHttpRequestsByIdRuntime(
      String(id),
      { runtime: snapshot, expectedRevision },
    )
    if (generation === token) {
      saved.value = JSON.stringify(snapshot)
      expectedRevision = data.runtimeRevision
      currentRequest.value = {
        ...currentRequest.value!,
        runtime: snapshot,
        runtimeRevision: data.runtimeRevision,
      }
    }
    return true
  }
  catch (error) {
    if (generation === token) {
      saveError.value = true
      const response
        = typeof error === 'object' && error !== null && 'response' in error
          ? error.response
          : null
      conflict.value
        = typeof response === 'object'
          && response !== null
          && 'status' in response
          && response.status === 409
    }
    return false
  }
  finally {
    saving.value = false
  }
}

async function saveRequest(): Promise<boolean> {
  if (
    busy.value
    || !currentRequest.value
    || currentRequest.value.runtimeState !== 'ready'
  ) {
    return false
  }
  if (!validateRuntime())
    return false
  savingRequest.value = true
  requestSaveError.value = false
  const token = generation
  try {
    if (!(await saveCurrentRequest())) {
      requestSaveError.value = true
      return false
    }
    if (token !== generation)
      return false
    return await saveRuntime()
  }
  finally {
    savingRequest.value = false
  }
}

function finishLeave(allowed: boolean) {
  leaveDialogOpen.value = false
  resolveLeave?.(allowed)
  resolveLeave = null
  leavePromise = null
}

async function resolveNavigation(choice: 'save' | 'discard' | 'cancel') {
  if (busy.value)
    return
  if (choice === 'save') {
    const success = await saveRequest()
    finishLeave(success && !requestDirty.value)
    return
  }
  if (choice === 'discard') {
    discardCurrentRequestChanges()
    draft.value = JSON.parse(saved.value || JSON.stringify(emptyHttpRuntime()))
    expectedInputs.value = {}
    expectedErrors.value = {}
    touched.value.clear()
    saveError.value = false
    conflict.value = false
    requestSaveError.value = false
  }
  finishLeave(choice === 'discard')
}

httpRuntimeNavigation.confirmLeave = () => {
  if (leavePromise)
    return leavePromise
  if (busy.value)
    return Promise.resolve(false)
  if (!requestDirty.value)
    return Promise.resolve(true)
  leaveDialogOpen.value = true
  leavePromise = new Promise((resolve) => {
    resolveLeave = resolve
  })
  return leavePromise
}

// Прямой reload из DevTools обходит меню и его асинхронный confirmLeave.
// Electron по умолчанию отменяет unload при preventDefault; обычный Quit
// проходит main request/ack и уничтожает окно только после подтверждения.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (event) => {
    if (requestDirty.value || busy.value) {
      event.preventDefault()
      event.returnValue = ''
    }
  })
}

export function useHttpRuntime() {
  return {
    requestDirty,
    busy,
    requestSaveError,
    saveRequest,
    validateRuntime,
    draft,
    dirty,
    valid,
    saving,
    saveError,
    conflict,
    saveRuntime,
    expectedInputs,
    expectedErrors,
    setExpected,
    removeAssertion,
    removeExtraction,
    touchField,
    fieldError,
    groupDirty,
    groupInvalid,
    focusTarget,
    leaveDialogOpen,
    resolveNavigation,
  }
}
