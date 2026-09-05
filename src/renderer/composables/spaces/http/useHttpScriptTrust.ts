import { ipc } from '@/electron'
import { emptyHttpScripts, hasHttpScripts } from '~/shared/httpScripts'
import { useHttpRequests } from './useHttpRequests'
import { useHttpRuntime } from './useHttpRuntime'

const trusted = ref(false)
const busy = ref(false)
const unavailable = ref(false)
const { currentRequest } = useHttpRequests()
const { draft } = useHttpRuntime()
const payload = computed(() => ({
  requestId: currentRequest.value?.id,
  scripts: draft.value.scripts ?? emptyHttpScripts(),
}))
const hasScripts = computed(() => hasHttpScripts(payload.value.scripts))
let revision = 0
watch(
  payload,
  async (value) => {
    const token = ++revision
    trusted.value = false
    unavailable.value = false
    if (!value.requestId)
      return
    try {
      const result = await ipc.invoke(
        'spaces:http:script-trust-status',
        JSON.parse(JSON.stringify(value)),
      )
      if (token === revision)
        trusted.value = result === true
    }
    catch {
      if (token === revision)
        unavailable.value = true
    }
  },
  { deep: true, immediate: true, flush: 'sync' },
)

async function setTrust(allowed: boolean) {
  if (busy.value || !payload.value.requestId)
    return
  const token = revision
  busy.value = true
  try {
    const result = await ipc.invoke(
      allowed ? 'spaces:http:script-trust' : 'spaces:http:script-revoke',
      JSON.parse(JSON.stringify(payload.value)),
    )
    if (token === revision) {
      trusted.value = result === true
      unavailable.value = false
    }
  }
  catch {
    if (token === revision)
      unavailable.value = true
  }
  finally {
    busy.value = false
  }
}
export function useHttpScriptTrust() {
  return { trusted, busy, unavailable, hasScripts, setTrust }
}
