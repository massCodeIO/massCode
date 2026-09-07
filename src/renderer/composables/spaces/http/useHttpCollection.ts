import type { HttpFoldersUpdate } from '@/services/api/generated'
import {
  emptyHttpCollection,
  httpCollectionSchema,
} from '~/shared/httpCollection'
import {
  httpExpectedSchema,
  httpOperatorNeedsExpected,
} from '~/shared/httpRuntime'
import { httpRuntimeNavigation } from './runtimeNavigation'
import { useHttpApp } from './useHttpApp'
import { useHttpFolders } from './useHttpFolders'
import { useHttpRuntime } from './useHttpRuntime'

const { httpState } = useHttpApp()
const { folders, getFolderByIdFromTree, updateHttpFolder } = useHttpFolders()
// Install the shared navigation dispatcher even before opening a request.
useHttpRuntime()
const collection = computed(() => {
  const folder = getFolderByIdFromTree(
    folders.value,
    httpState.folderId ?? null,
  )
  return httpState.activePanel === 'folder' && folder?.parentId === null
    ? folder
    : null
})
type Config = NonNullable<HttpFoldersUpdate['collectionConfig']>
const draft = ref<Config>(emptyHttpCollection())
const saved = ref(JSON.stringify(draft.value))
const saving = ref(false)
const saveError = ref(false)
const submitted = ref(false)
const leaveDialogOpen = ref(false)
const expectedInputs = ref<Record<number, string>>({})
const expectedErrors = ref<Record<number, boolean>>({})
const hasExpectedErrors = computed(() =>
  Object.entries(expectedErrors.value).some(
    ([index, error]) =>
      error
      && httpOperatorNeedsExpected(
        draft.value.runtime.assertions[Number(index)]?.operator ?? 'exists',
      ),
  ),
)
const dirty = computed(
  () => JSON.stringify(draft.value) !== saved.value || hasExpectedErrors.value,
)
const unavailable = computed(
  () => collection.value?.collectionConfigState === 'invalid',
)
const validation = computed(() => httpCollectionSchema.safeParse(draft.value))
const valid = computed(
  () => validation.value.success && !hasExpectedErrors.value,
)
let owner: number | null = null
let leavePromise: Promise<boolean> | null = null
let resolveLeave: ((allowed: boolean) => void) | null = null
const runtime = computed({
  get: () => draft.value.runtime,
  set: value => (draft.value.runtime = value),
})

function resetInputs() {
  expectedInputs.value = {}
  expectedErrors.value = {}
  saveError.value = false
  submitted.value = false
}
watch(
  collection,
  (value) => {
    if (value?.id === owner && dirty.value)
      return
    owner = value?.id ?? null
    draft.value = JSON.parse(
      JSON.stringify(value?.collectionConfig ?? emptyHttpCollection()),
    )
    saved.value = JSON.stringify(draft.value)
    resetInputs()
  },
  { immediate: true, flush: 'sync' },
)

async function save(): Promise<boolean> {
  if (!collection.value || unavailable.value || saving.value)
    return false
  submitted.value = true
  if (!valid.value)
    return false
  if (!dirty.value)
    return true
  const id = collection.value.id
  const snapshot: Config = JSON.parse(JSON.stringify(draft.value))
  saving.value = true
  saveError.value = false
  try {
    const success = await updateHttpFolder(id, { collectionConfig: snapshot })
    if (owner === id) {
      saveError.value = !success
      if (success)
        saved.value = JSON.stringify(snapshot)
    }
    return success
  }
  finally {
    saving.value = false
  }
}
function discard() {
  draft.value = JSON.parse(saved.value)
  resetInputs()
}
async function resolveNavigation(choice: 'save' | 'discard' | 'cancel') {
  if (saving.value)
    return
  if (choice === 'save' && (!(await save()) || dirty.value))
    return
  if (choice === 'discard')
    discard()
  leaveDialogOpen.value = false
  resolveLeave?.(choice !== 'cancel')
  leavePromise = null
  resolveLeave = null
}
httpRuntimeNavigation.confirmCollectionLeave = () => {
  if (leavePromise)
    return leavePromise
  if (saving.value)
    return Promise.resolve(false)
  if (!dirty.value)
    return Promise.resolve(true)
  leaveDialogOpen.value = true
  leavePromise = new Promise(resolve => (resolveLeave = resolve))
  return leavePromise
}
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (event) => {
    if (dirty.value || saving.value) {
      event.preventDefault()
      event.returnValue = ''
    }
  })
}
function setExpected(index: number, text: string | number) {
  expectedInputs.value[index] = String(text)
  try {
    runtime.value.assertions[index]!.expected = httpExpectedSchema.parse(
      JSON.parse(String(text)),
    )
    expectedErrors.value[index] = false
  }
  catch {
    expectedErrors.value[index] = true
  }
}
function removeAssertion(index: number) {
  runtime.value.assertions.splice(index, 1)
  for (const entries of [expectedInputs, expectedErrors]) {
    entries.value = Object.fromEntries(
      Object.entries(entries.value)
        .filter(([key]) => Number(key) !== index)
        .map(([key, value]) => [
          Number(key) > index ? Number(key) - 1 : key,
          value,
        ]),
    )
  }
}
function fieldError(
  group: 'extractions' | 'assertions',
  index: number,
  field: 'name' | 'path' | 'expected',
) {
  if (!submitted.value)
    return undefined
  if (
    group === 'assertions'
    && field === 'expected'
    && expectedErrors.value[index]
    && httpOperatorNeedsExpected(
      runtime.value.assertions[index]?.operator ?? 'exists',
    )
  ) {
    return 'expectedValue'
  }
  const issue = validation.value.error?.issues.find(
    issue => issue.path.join('.') === `runtime.${group}.${index}.${field}`,
  )
  return issue
    ? issue.code === 'custom'
      ? issue.message
      : 'invalid'
    : undefined
}
const runtimeContext = {
  draft: runtime,
  saving,
  expectedInputs,
  setExpected,
  removeAssertion,
  removeExtraction: (index: number) =>
    runtime.value.extractions.splice(index, 1),
  fieldError,
  touchField: () => {},
}
export function useHttpCollection() {
  return {
    collection,
    draft,
    dirty,
    saving,
    saveError,
    submitted,
    valid,
    unavailable,
    save,
    discard,
    leaveDialogOpen,
    resolveNavigation,
    runtimeContext,
  }
}
