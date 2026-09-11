import type {
  HttpEnvironmentsAdd,
  HttpEnvironmentsResponse,
  HttpEnvironmentsUpdate,
} from '@/services/api/generated'
import { useSonner } from '@/composables/useSonner'
import { markPersistedStorageMutation } from '@/composables/useStorageMutation'
import { i18n } from '@/electron'
import { api } from '@/services/api'
import { maskHttpSecretVariables } from '~/shared/httpVariables'
import { useHttpSession } from './useHttpSession'

export type HttpEnvironment = HttpEnvironmentsResponse['items'][number]

const environmentSaveErrorId = ref<number | null>(null)

const environments = shallowRef<HttpEnvironment[]>([])
const activeEnvironmentId = ref<number | null>(null)
const { maskedSessionVariables, resetHttpSessionNames } = useHttpSession()
watch(activeEnvironmentId, resetHttpSessionNames, { flush: 'sync' })

const activeEnvironment = computed(() => {
  if (activeEnvironmentId.value === null)
    return null
  return (
    environments.value.find(env => env.id === activeEnvironmentId.value)
    ?? null
  )
})

/**
 * Переменные активного окружения для превью и подсветки. Значения секретов
 * в renderer не попадают вовсе: подставляется маска, а реальное значение
 * известно только main-процессу в момент выполнения запроса.
 */
const activeEnvironmentVariables = computed<Record<string, string>>(() => {
  const env = activeEnvironment.value
  if (!env)
    return maskedSessionVariables.value

  return {
    ...maskHttpSecretVariables(
      env.variables as Record<string, string>,
      env.secretKeys,
    ),
    ...maskedSessionVariables.value,
  }
})

function notifyEnvironmentError(
  error: unknown,
  operation: 'load' | 'create' | 'delete' | 'activate',
) {
  if (
    typeof error === 'object'
    && error !== null
    && 'response' in error
    && (error.response as { status?: number } | undefined)?.status === 503
  ) {
    return
  }
  useSonner().sonner({
    id: `http-environment-${operation}`,
    type: 'error',
    message: i18n.t(`messages:error.httpEnvironment.${operation}`),
  })
}

async function getHttpEnvironments() {
  try {
    const { data } = await api.httpEnvironments.getHttpEnvironments()
    environments.value = data.items
    activeEnvironmentId.value = data.activeId
  }
  catch (error) {
    console.error(error)
    notifyEnvironmentError(error, 'load')
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
    notifyEnvironmentError(error, 'create')
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
    if (environmentSaveErrorId.value === environmentId)
      environmentSaveErrorId.value = null
    await getHttpEnvironments()
  }
  catch (error) {
    console.error(error)
    environmentSaveErrorId.value = environmentId
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
    notifyEnvironmentError(error, 'delete')
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
    notifyEnvironmentError(error, 'activate')
  }
}

function resetHttpEnvironmentsState() {
  environmentSaveErrorId.value = null
  environments.value = []
  activeEnvironmentId.value = null
}

export function useHttpEnvironments() {
  return {
    activeEnvironment,
    activeEnvironmentId,
    activeEnvironmentVariables,
    createHttpEnvironment,
    deleteHttpEnvironment,
    environments,
    environmentSaveErrorId,
    getHttpEnvironments,
    resetHttpEnvironmentsState,
    setActiveHttpEnvironment,
    updateHttpEnvironment,
  }
}
