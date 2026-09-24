import type { NativeBridgeResult } from './nativeBridges'
import type { HttpAiSnapshot } from './useHttpAi'
import type { AiNativeAction } from '~/shared/aiNativeActions'
import { chooseHttpFile } from '@/composables/spaces/http/chooseHttpFile'
import { useHttpEnvironments } from '@/composables/spaces/http/useHttpEnvironments'
import { useHttpRequests } from '@/composables/spaces/http/useHttpRequests'
import { useHttpUi } from '@/composables/spaces/http/useHttpUi'

type SecretAction = Extract<AiNativeAction, { action: 'enterHttpSecret' }>
export const httpSecretHandoff = shallowRef<{
  action: SecretAction
  current: () => boolean
  finish: (result: NativeBridgeResult) => void
}>()

export async function executeHttpHandoff(
  action: Extract<
    AiNativeAction,
    { action: 'chooseHttpFile' | 'enterHttpSecret' }
  >,
  current: () => boolean,
  capture?: () => HttpAiSnapshot | undefined,
): Promise<NativeBridgeResult> {
  if (!current())
    return { status: 'stale' }
  if (action.action === 'chooseHttpFile') {
    const { currentDraft, currentRequest } = useHttpRequests()
    const draft = currentDraft.value
    if (!draft || currentRequest.value?.id !== action.target.id)
      return { status: 'stale' }
    const entry
      = action.field.kind === 'multipart'
        ? draft.formData[action.field.index]
        : undefined
    if (
      action.field.kind === 'multipart'
      && (!entry || entry.key !== action.field.key || entry.type !== 'file')
    ) {
      return { status: 'unavailable' }
    }
    // Capture after claiming the action and immediately before the picker's
    // own baseline, so edits made during the earlier claim remain user-owned.
    const snapshot = capture?.()
    if (
      !snapshot?.privateDraft
      || snapshot.privateDraft.requestId !== action.target.id
    ) {
      return { status: 'unavailable' }
    }
    const before: HttpAiSnapshot = JSON.parse(JSON.stringify(snapshot))
    const result = await chooseHttpFile(
      draft,
      entry,
      () =>
        current()
        && currentDraft.value === draft
        && currentRequest.value?.id === action.target.id,
    )
    if (result.status !== 'done')
      return result
    const after = capture?.()
    if (
      !after?.privateDraft
      || after.privateDraft.requestId !== action.target.id
    ) {
      return { status: 'stale', persisted: false }
    }
    return {
      ...result,
      mutation: {
        kind: 'httpDraft',
        before,
        after: JSON.parse(JSON.stringify(after)),
      },
    }
  }
  const environments = useHttpEnvironments()
  if (!(await environments.getHttpEnvironments()))
    return { status: 'failed' }
  if (!current())
    return { status: 'stale' }
  const environment = environments.environments.value.find(
    env => env.id === action.environmentId,
  )
  if (
    httpSecretHandoff.value
    || !environment
    || (!environment.secretKeys.includes(action.key)
      && Object.prototype.hasOwnProperty.call(environment.variables, action.key))
  ) {
    return { status: 'unavailable' }
  }
  return new Promise((resolve) => {
    let stop: (() => void) | undefined
    const pending = {
      action,
      current,
      finish: (result: NativeBridgeResult) => {
        if (httpSecretHandoff.value !== pending)
          return
        httpSecretHandoff.value = undefined
        stop?.()
        resolve(result)
      },
    }
    httpSecretHandoff.value = pending
    stop = watch(
      current,
      (valid) => {
        if (!valid)
          pending.finish({ status: 'stale' })
      },
      { flush: 'sync' },
    )
    useHttpUi().environmentsOpen.value = true
  })
}

/** Closing the local editor must not cancel a receipt ahead of its native save. */
export async function closeHttpSecretHandoff(flush: () => Promise<void>) {
  const pending = httpSecretHandoff.value
  if (!pending)
    return
  try {
    await flush()
    // A saved/failed secret has already completed the handoff during flush.
    // Only an untouched entry reaches cancellation here.
    if (httpSecretHandoff.value === pending)
      pending.finish({ status: 'cancelled' })
  }
  catch {
    if (httpSecretHandoff.value === pending)
      pending.finish({ status: 'failed' })
  }
}
