import { ipc } from '@/electron'
import { HTTP_SECRET_MASK } from '~/shared/httpVariables'

const sessionNames = ref<string[]>([])
const maskedSessionVariables = computed<Record<string, string>>(() =>
  Object.fromEntries(
    sessionNames.value.map(name => [name, HTTP_SECRET_MASK]),
  ),
)
let sessionToken = 0

async function refreshHttpSessionNames() {
  const token = ++sessionToken
  const names = (await ipc.invoke(
    'spaces:http:session-names',
    null,
  )) as string[]
  if (token === sessionToken)
    sessionNames.value = names
}

function resetHttpSessionNames() {
  sessionToken += 1
  sessionNames.value = []
}

async function clearHttpSession() {
  resetHttpSessionNames()
  await ipc.invoke('spaces:http:clear-session', null)
}

export function useHttpSession() {
  return {
    sessionNames,
    maskedSessionVariables,
    refreshHttpSessionNames,
    clearHttpSession,
    resetHttpSessionNames,
  }
}
