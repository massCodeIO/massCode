import type { HttpRunStart, HttpRunView } from '~/shared/httpRunner'
import { useSonner } from '@/composables/useSonner'
import { i18n, ipc } from '@/electron'
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
const continueOnFailure = ref(false)
const folderId = ref<number | null>(null)
let generation = 0

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

async function openRunner(id: number) {
  if (running.value || preparing.value)
    return
  const token = ++generation
  preparing.value = true
  try {
    if (!(await httpRuntimeNavigation.confirmLeave()) || generation !== token)
      return
    const transition = ++httpRuntimeNavigation.transitionToken
    const prepared = await ipc.invoke<{ folderId: number }, HttpRunView>(
      'spaces:http:run-prepare',
      { folderId: id },
    )
    if (
      generation !== token
      || transition !== httpRuntimeNavigation.transitionToken
    ) {
      return
    }
    folderId.value = id
    view.value = prepared
    open.value = true
    if (httpState.activePanel !== 'runner')
      previousPanel = httpState.activePanel
    httpState.activePanel = 'runner'
  }
  catch (error) {
    if (generation === token)
      showError(error)
  }
  finally {
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
  open.value = false
  if (httpState.activePanel === 'runner')
    httpState.activePanel = previousPanel
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
    startRunner,
    cancelRunner,
    closeRunner,
    clearRunnerView,
    reorderSteps,
  }
}
