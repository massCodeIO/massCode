import type { ComputedRef } from 'vue'
import type { HttpScripts } from '~/shared/httpScripts'
import { ipc } from '@/electron'
import { emptyHttpScripts, hasHttpScripts } from '~/shared/httpScripts'
import { useHttpRequests } from './useHttpRequests'
import { useHttpRuntime } from './useHttpRuntime'

export function useHttpScriptTrust(
  collectionPayload?: ComputedRef<{
    collectionId?: number
    scripts: HttpScripts
  }>,
) {
  const trusted = ref(false)
  const busy = ref(false)
  const unavailable = ref(false)
  const { currentRequest } = useHttpRequests()
  const { draft } = useHttpRuntime()
  const payload: ComputedRef<{
    requestId?: number
    collectionId?: number
    scripts: HttpScripts
  }>
    = collectionPayload
      ?? computed(() => ({
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
      if (!('collectionId' in value ? value.collectionId : value.requestId))
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
    if (
      busy.value
      || !('collectionId' in payload.value
        ? payload.value.collectionId
        : payload.value.requestId)
    ) {
      return
    }
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
  return { trusted, busy, unavailable, hasScripts, setTrust }
}
