import type { NativeBridgeResult } from './nativeBridges'
import type { AiNativeAction } from '~/shared/aiNativeActions'
import { router, RouterName } from '@/router'

type PreferenceFlow = Extract<
  AiNativeAction,
  { action: 'storage' | 'configureAi' }
>
type Handler = (
  action: PreferenceFlow,
  id: string,
  current: () => boolean,
) => Promise<NativeBridgeResult>
const handlers = new Map<PreferenceFlow['action'], Handler>()
export const preferenceFlowResult = shallowRef<NativeBridgeResult>()
export function registerPreferenceFlow(
  kind: PreferenceFlow['action'],
  handler: Handler,
) {
  handlers.set(kind, handler)
  return () => {
    if (handlers.get(kind) === handler)
      handlers.delete(kind)
  }
}
export async function executePreferenceFlow(
  action: PreferenceFlow,
  id: string,
  current: () => boolean,
): Promise<NativeBridgeResult> {
  preferenceFlowResult.value = undefined
  await router.push({
    name:
      action.action === 'storage'
        ? RouterName.preferencesStorage
        : RouterName.preferencesAI,
  })
  await nextTick()
  if (!current())
    return { status: 'stale' }
  const result = await (handlers.get(action.action)?.(action, id, current) ?? {
    status: 'unavailable' as const,
  })
  preferenceFlowResult.value = result
  return result
}

interface Handoff {
  id: string
  kind: 'configureAi' | 'doctorApply'
  current: () => boolean
  busy: boolean
  cancelRequested: boolean
  partial?: NativeBridgeResult
  finish: (result: NativeBridgeResult) => void
}
export const preferenceHandoff = shallowRef<Handoff>()
export function waitForPreferenceUser(
  kind: Handoff['kind'],
  id: string,
  current: () => boolean,
): Promise<NativeBridgeResult> {
  if (preferenceHandoff.value)
    return Promise.resolve({ status: 'unavailable' })
  return new Promise((resolve) => {
    let stop: (() => void) | undefined
    const handoff: Handoff = reactive({
      id,
      kind,
      current,
      busy: false,
      cancelRequested: false,
      finish: (result: NativeBridgeResult) => {
        if (preferenceHandoff.value?.id !== id)
          return
        preferenceHandoff.value = undefined
        stop?.()
        resolve(result)
      },
    })
    preferenceHandoff.value = handoff
    stop = watch(
      current,
      (valid) => {
        if (!valid)
          cancelPreferenceHandoff(id)
      },
      { flush: 'sync' },
    )
    if (!current())
      cancelPreferenceHandoff(id)
  })
}
export function claimPreferenceHandoff(kind: Handoff['kind']) {
  const pending = preferenceHandoff.value
  if (
    !pending
    || pending.kind !== kind
    || pending.busy
    || !pending.current()
    || pending.cancelRequested
  ) {
    return undefined
  }
  pending.busy = true
  return pending.id
}
export function finishPreferenceHandoff(
  id: string | undefined,
  result: NativeBridgeResult,
  keepOpen = false,
) {
  const pending = preferenceHandoff.value
  if (!id || pending?.id !== id)
    return
  pending.busy = false
  const accumulated
    = pending.partial?.persisted && !result.persisted
      ? {
          ...result,
          persisted: true,
          profile: pending.partial.profile,
          storage: pending.partial.storage,
        }
      : result
  pending.partial = accumulated
  if (!keepOpen || pending.cancelRequested) {
    pending.finish(
      pending.cancelRequested
        ? { ...accumulated, status: 'cancelled' }
        : accumulated,
    )
  }
}
export function cancelPreferenceHandoff(id = preferenceHandoff.value?.id) {
  const pending = preferenceHandoff.value
  if (!id || pending?.id !== id)
    return
  pending.cancelRequested = true
  if (!pending.busy)
    pending.finish({ ...pending.partial, status: 'cancelled' })
}
