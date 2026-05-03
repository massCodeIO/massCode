import type {
  HttpEnvironmentsAdd,
  HttpEnvironmentsResponse,
  HttpEnvironmentsUpdate,
} from '@/services/api/generated'
import { markPersistedStorageMutation } from '@/composables/useStorageMutation'
import { api } from '@/services/api'

export type HttpEnvironment = HttpEnvironmentsResponse['items'][number]

const environments = shallowRef<HttpEnvironment[]>([])
const activeEnvironmentId = ref<number | null>(null)

const activeEnvironment = computed(() => {
  if (activeEnvironmentId.value === null)
    return null
  return (
    environments.value.find(env => env.id === activeEnvironmentId.value)
    ?? null
  )
})

async function getHttpEnvironments() {
  try {
    const { data } = await api.httpEnvironments.getHttpEnvironments()
    environments.value = data.items
    activeEnvironmentId.value = data.activeId
  }
  catch (error) {
    console.error(error)
  }
}

async function createHttpEnvironment(payload: HttpEnvironmentsAdd) {
  try {
    markPersistedStorageMutation()
    const { data } = await api.httpEnvironments.postHttpEnvironments(payload)
    await getHttpEnvironments()
    return Number(data.id)
  }
  catch (error) {
    console.error(error)
  }
}

async function updateHttpEnvironment(
  environmentId: number,
  data: HttpEnvironmentsUpdate,
) {
  try {
    markPersistedStorageMutation()
    await api.httpEnvironments.patchHttpEnvironmentsById(
      String(environmentId),
      data,
    )
    await getHttpEnvironments()
  }
  catch (error) {
    console.error(error)
  }
}

async function deleteHttpEnvironment(environmentId: number) {
  try {
    markPersistedStorageMutation()
    await api.httpEnvironments.deleteHttpEnvironmentsById(
      String(environmentId),
    )
    await getHttpEnvironments()
  }
  catch (error) {
    console.error(error)
  }
}

async function setActiveHttpEnvironment(environmentId: number | null) {
  try {
    markPersistedStorageMutation()
    await api.httpEnvironments.postHttpEnvironmentsActive({
      id: environmentId,
    })
    activeEnvironmentId.value = environmentId
  }
  catch (error) {
    console.error(error)
  }
}

function resetHttpEnvironmentsState() {
  environments.value = []
  activeEnvironmentId.value = null
}

export function useHttpEnvironments() {
  return {
    activeEnvironment,
    activeEnvironmentId,
    createHttpEnvironment,
    deleteHttpEnvironment,
    environments,
    getHttpEnvironments,
    resetHttpEnvironmentsState,
    setActiveHttpEnvironment,
    updateHttpEnvironment,
  }
}
