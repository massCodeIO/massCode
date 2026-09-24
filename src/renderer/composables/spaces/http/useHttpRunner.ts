import type { HttpRunStart, HttpRunView } from '~/shared/httpRunner'
import { useSonner } from '@/composables/useSonner'
import { i18n, ipc, store } from '@/electron'
import { router, RouterName } from '@/router'
import { httpRuntimeNavigation } from './runtimeNavigation'
import { useHttpApp } from './useHttpApp'
import { useHttpSettings } from './useHttpSettings'

const { httpState } = useHttpApp()
let previousPanel: typeof httpState.activePanel = 'request'
const open = ref(false)
const preparing = ref(false)
const running = ref(false)
const cancelling = ref(false)
const view = ref<HttpRunView | null>(null)
const preferredContinueOnFailure = ref(false)
const continueOnFailure = computed({
  get: () => view.value?.continueOnFailure ?? preferredContinueOnFailure.value,
  set: (value: boolean) => {
    preferredContinueOnFailure.value = value
  },
})
const folderId = ref<number | null>(null)
let generation = 0
let snapshotMode = false
let adoptedTimer: ReturnType<typeof setInterval> | undefined

function showError(error: unknown) {
  const text = String(error)
  const codes = [
    'HTTP_RUN_EMPTY',
    'HTTP_RUN_TOO_LARGE',
    'HTTP_RUN_REQUEST_UNAVAILABLE',
    'HTTP_CONTEXT_CHANGED',
    'HTTP_REQUEST_RUNNING',
  ]
  const code = codes.find(code => text.includes(code)) ?? 'unknown'
  useSonner().sonner({
    type: 'error',
    message: i18n.t(`spaces.http.runner.errors.${code}`),
  })
}

async function openRunner(
  id: number,
  current: () => boolean = () => true,
): Promise<'ready' | 'cancelled' | 'stale' | 'failed' | 'unavailable'> {
  if (!current())
    return 'stale'
  if (running.value || preparing.value)
    return 'unavailable'
  const token = ++generation
  preparing.value = true
  try {
    if (!(await httpRuntimeNavigation.confirmLeave()))
      return 'cancelled'
    if (generation !== token || !current())
      return 'stale'
    const transition = ++httpRuntimeNavigation.transitionToken
    const prepared = await ipc.invoke<{ folderId: number }, HttpRunView>(
      'spaces:http:run-prepare',
      { folderId: id },
    )
    if (
      generation !== token
      || !current()
      || transition !== httpRuntimeNavigation.transitionToken
    ) {
      return 'stale'
    }
    snapshotMode = false
    folderId.value = id
    view.value = prepared
    open.value = true
    if (httpState.activePanel !== 'runner')
      previousPanel = httpState.activePanel
    httpState.activePanel = 'runner'
    return 'ready'
  }
  catch (error) {
    if (generation === token)
      showError(error)
    return 'failed'
  }
  finally {
    preparing.value = false
  }
}

async function adoptRunner(
  runId: string,
  vault: string,
  snapshot?: HttpRunView,
) {
  const captured
    = snapshot && ['passed', 'failed', 'cancelled'].includes(snapshot.state)
      ? (JSON.parse(JSON.stringify(snapshot)) as HttpRunView)
      : undefined
  // Keep the live runner's polling, Stop control and completion callback intact.
  if (captured && running.value) {
    if (vault !== (store.preferences.get<string>('storage.vaultPath') ?? ''))
      return
    await router.push({ name: RouterName.httpSpace })
    if (open.value)
      httpState.activePanel = 'runner'
    return
  }
  const token = ++generation
  clearInterval(adoptedTimer)
  preparing.value = true
  const isCurrent = () =>
    token === generation
    && vault === (store.preferences.get<string>('storage.vaultPath') ?? '')
  let polling = false
  const poll = async () => {
    if (polling)
      return
    if (!isCurrent()) {
      clearInterval(adoptedTimer)
      return
    }
    polling = true
    try {
      const status = await ipc.invoke<string, HttpRunView>(
        'spaces:http:run-status',
        runId,
      )
      if (!isCurrent() || status.runId !== runId)
        return
      view.value = status
      running.value = status.state === 'running' || status.state === 'ready'
      if (!running.value) {
        clearInterval(adoptedTimer)
        cancelling.value = false
      }
    }
    catch (error) {
      if (isCurrent()) {
        clearInterval(adoptedTimer)
        running.value = false
        showError(error)
      }
    }
    finally {
      polling = false
    }
  }
  try {
    await router.push({ name: RouterName.httpSpace })
    if (!isCurrent())
      return
    if (captured) {
      snapshotMode = true
      view.value = captured
      running.value = false
      cancelling.value = false
    }
    else {
      await poll()
      if (!isCurrent() || view.value?.runId !== runId)
        return
      snapshotMode = false
    }
    folderId.value = view.value!.folderId
    open.value = true
    if (httpState.activePanel !== 'runner')
      previousPanel = httpState.activePanel
    httpState.activePanel = 'runner'
    if (running.value)
      adoptedTimer = setInterval(() => void poll(), 200)
  }
  finally {
    if (token === generation)
      preparing.value = false
  }
}

async function startRunner() {
  if (
    !open.value
    || !view.value
    || running.value
    || view.value.state !== 'ready'
  ) {
    return
  }
  const token = generation
  const runId = view.value.runId
  running.value = true
  view.value.state = 'running'
  const { settings } = useHttpSettings()
  let polling = false
  const timer = setInterval(async () => {
    if (polling)
      return
    polling = true
    try {
      const status = await ipc.invoke<string, HttpRunView>(
        'spaces:http:run-status',
        runId,
      )
      if (token === generation && running.value && view.value?.runId === runId)
        view.value = status
    }
    catch {
      /* The start call reports errors. */
    }
    finally {
      polling = false
    }
  }, 200)
  try {
    const result = await ipc.invoke<HttpRunStart, HttpRunView>(
      'spaces:http:run-start',
      {
        runId,
        requestIds: view.value.steps.map(step => step.requestId),
        continueOnFailure: continueOnFailure.value,
        skipCertificateVerification: settings.skipCertificateVerification,
        transport: JSON.parse(JSON.stringify(settings.transport ?? {})),
      },
    )
    if (token === generation)
      view.value = result
  }
  catch (error) {
    if (token === generation) {
      if (view.value)
        view.value.state = 'failed'
      showError(error)
    }
  }
  finally {
    clearInterval(timer)
    running.value = false
    cancelling.value = false
  }
}

async function cancelRunner() {
  if (!open.value || !view.value || !running.value || cancelling.value)
    return
  cancelling.value = true
  try {
    await ipc.invoke('spaces:http:run-cancel', view.value.runId)
  }
  catch (error) {
    cancelling.value = false
    showError(error)
  }
}

function closeRunner() {
  if (!open.value && !preparing.value)
    return
  generation += 1
  clearInterval(adoptedTimer)
  running.value = false
  cancelling.value = false
  preparing.value = false
  open.value = false
  if (httpState.activePanel === 'runner')
    httpState.activePanel = previousPanel
  if (!snapshotMode)
    void ipc.invoke('spaces:http:run-dispose', null).catch(showError)
}

function clearRunnerView() {
  if (open.value)
    return
  view.value = null
  folderId.value = null
}

function reorderSteps(steps: HttpRunView['steps']) {
  if (
    !open.value
    || !view.value
    || running.value
    || view.value.state !== 'ready'
  ) {
    return
  }
  view.value.steps = steps
}

export function useHttpRunner() {
  return {
    open,
    preparing,
    running,
    cancelling,
    view,
    folderId,
    continueOnFailure,
    openRunner,
    adoptRunner,
    startRunner,
    cancelRunner,
    closeRunner,
    clearRunnerView,
    reorderSteps,
  }
}
