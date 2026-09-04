import type { HttpRequestItemResponse } from '@/services/api/generated'
import { markPersistedStorageMutation } from '@/composables/useStorageMutation'
import { api } from '@/services/api'
import { emptyHttpRuntime, isHttpRuntime } from '~/shared/httpRuntime'
import { useHttpRequests } from './useHttpRequests'

type Runtime = NonNullable<HttpRequestItemResponse['runtime']>
const draft = ref<Runtime>(emptyHttpRuntime())
const saved = ref('')
const saving = ref(false)
const saveError = ref(false)
const conflict = ref(false)
const expectedInputs = ref<Record<number, string>>({})
const expectedErrors = ref<Record<number, boolean>>({})
let expectedRevision: string | null = null
const hasExpectedErrors = computed(() =>
  Object.entries(expectedErrors.value).some(
    ([index, invalid]) =>
      invalid && draft.value.assertions[Number(index)]?.operator !== 'exists',
  ),
)
const dirty = computed(
  () => hasExpectedErrors.value || JSON.stringify(draft.value) !== saved.value,
)
const valid = computed(
  () => !hasExpectedErrors.value && isHttpRuntime(draft.value),
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
  },
  { immediate: true, flush: 'sync' },
)

function setExpected(index: number, text: string | number) {
  expectedInputs.value[index] = String(text)
  try {
    const value: unknown = JSON.parse(String(text))
    if (
      value !== null
      && !['string', 'number', 'boolean'].includes(typeof value)
    ) {
      throw new Error('Expected scalar')
    }
    draft.value.assertions[index]!.expected = value as
    | string
    | number
    | boolean
    | null
    expectedErrors.value[index] = false
  }
  catch {
    expectedErrors.value[index] = true
  }
}

function removeAssertion(index: number) {
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

async function saveRuntime(): Promise<boolean> {
  const request = currentRequest.value
  if (
    !request
    || request.runtimeState !== 'ready'
    || expectedRevision === null
    || !valid.value
    || saving.value
  ) {
    return false
  }
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
  }
}
