import type { HttpRequestItemResponse } from '@/services/api/generated'
import { markPersistedStorageMutation } from '@/composables/useStorageMutation'
import { api } from '@/services/api'
import {
  emptyHttpRuntime,
  httpExpectedSchema,
  httpOperatorNeedsExpected,
  httpRuntimeSchema,
} from '~/shared/httpRuntime'
import { useHttpRequests } from './useHttpRequests'

type Runtime = NonNullable<HttpRequestItemResponse['runtime']>
const draft = ref<Runtime>(emptyHttpRuntime())
const saved = ref('')
const saving = ref(false)
const saveError = ref(false)
const conflict = ref(false)
const expectedInputs = ref<Record<number, string>>({})
const expectedErrors = ref<Record<number, boolean>>({})
type RuleGroup = 'extractions' | 'assertions'
type RuleField = 'name' | 'path' | 'expected'
type Rule = Runtime[RuleGroup][number]
const touched = ref(new Map<Rule, Set<RuleField>>())
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
const { currentRequest } = useHttpRequests()
let owner: string | null = null
let generation = 0

watch(
  currentRequest,
  (request) => {
    const nextOwner = request ? `${request.id}:${request.createdAt}` : null
    if (nextOwner === owner && dirty.value)
      return
    if (nextOwner !== owner)
      generation += 1
    owner = nextOwner
    draft.value = structuredClone(request?.runtime ?? emptyHttpRuntime())
    saved.value = JSON.stringify(draft.value)
    expectedRevision = request?.runtimeRevision ?? null
    saveError.value = false
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

async function saveRuntime(): Promise<boolean> {
  const request = currentRequest.value
  if (
    !request
    || request.runtimeState !== 'ready'
    || expectedRevision === null
    || saving.value
  ) {
    return false
  }
  for (const group of ['extractions', 'assertions'] as const) {
    draft.value[group].forEach((_, index) => {
      for (const field of ['name', 'path', 'expected'] as const)
        touchField(group, index, field)
    })
  }
  if (!valid.value)
    return false
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

export function useHttpRuntime() {
  return {
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
  }
}
