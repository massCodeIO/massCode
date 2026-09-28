import type { AiHttpWebSocketReceipt } from '~/shared/aiHttpActions'
import type { WsConnect, WsError, WsView } from '~/shared/httpWebSocket'
import { ipc } from '@/electron'
import { WS_LOG_LIMIT } from '~/shared/httpWebSocket'
import { useHttpApp } from './useHttpApp'
import { useHttpEnvironments } from './useHttpEnvironments'
import { useHttpRequests } from './useHttpRequests'
import { useHttpSettings } from './useHttpSettings'

const view = shallowRef<WsView | null>(null)
const error = ref<WsError | null>(null)
const sending = ref(false)
const { currentDraft, currentRequest, isCurrentRequestLoading }
  = useHttpRequests()
const { httpState } = useHttpApp()
const { activeEnvironmentId } = useHttpEnvironments()
const { settings } = useHttpSettings()
const isWebSocket = computed(
  () => currentDraft.value?.protocol === 'websocket',
)
const active = computed(
  () =>
    !!view.value
    && ['connecting', 'open', 'closing'].includes(view.value.state),
)
let token = 0
let timer: ReturnType<typeof setInterval> | undefined
let connectionId: string | null = null
let reading = false
let logToken = 0
let clearing = false

function errorCode(cause: unknown): WsError {
  const message = cause instanceof Error ? cause.message : String(cause)
  if (message.includes('WS_INVALID'))
    return 'invalid'
  if (message.includes('WS_CONTEXT_CHANGED'))
    return 'contextChanged'
  if (message.includes('WS_UNAVAILABLE'))
    return 'unavailable'
  if (message.includes('WS_NOT_OPEN'))
    return 'notOpen'
  if (message.includes('WS_TOO_LARGE'))
    return 'tooLarge'
  if (message.includes('WS_BUSY'))
    return 'busy'
  return 'network'
}

function dispose() {
  ++token
  clearInterval(timer)
  const id = connectionId
  connectionId = null
  view.value = null
  error.value = null
  sending.value = false
  reading = false
  clearing = false
  if (id) {
    void ipc
      .invoke('spaces:http:ws-dispose', { connectionId: id })
      .catch(() => {})
  }
}

watch(
  [
    () => httpState.requestId,
    () => currentRequest.value?.id,
    activeEnvironmentId,
    isWebSocket,
  ],
  dispose,
  { flush: 'sync' },
)

async function poll(ownToken: number, id: string) {
  if (reading || clearing || ownToken !== token)
    return
  reading = true
  const ownLogToken = logToken
  try {
    const result = (await ipc.invoke('spaces:http:ws-read', {
      connectionId: id,
      after: view.value?.lastId ?? 0,
    })) as WsView
    if (ownToken !== token || ownLogToken !== logToken)
      return
    const messages = [
      ...(view.value?.messages ?? []),
      ...result.messages,
    ].slice(-WS_LOG_LIMIT)
    view.value = { ...result, messages }
    if (['closed', 'error'].includes(result.state))
      clearInterval(timer)
  }
  catch (cause) {
    if (ownToken === token) {
      error.value = errorCode(cause)
      clearInterval(timer)
      if (view.value)
        view.value = { ...view.value, state: 'error' }
      void ipc
        .invoke('spaces:http:ws-dispose', { connectionId: id })
        .catch(() => {})
    }
  }
  finally {
    if (ownToken === token)
      reading = false
  }
}

async function connect() {
  const draft = currentDraft.value
  const request = currentRequest.value
  if (
    (httpState.activePanel !== undefined
      && httpState.activePanel !== 'request')
    || !draft
    || !request
    || !isWebSocket.value
    || active.value
    || isCurrentRequestLoading.value
    || request.pendingCloudDownload
    || httpState.requestId !== request.id
  ) {
    return
  }
  dispose()
  const ownToken = token
  const id = crypto.randomUUID()
  connectionId = id
  view.value = {
    connectionId: id,
    state: 'connecting',
    messages: [],
    lastId: 0,
    dropped: 0,
  }
  const payload: WsConnect = JSON.parse(
    JSON.stringify({
      connectionId: id,
      requestId: request.id,
      environmentId: activeEnvironmentId.value,
      url: draft.url,
      headers: draft.headers,
      query: draft.query,
      auth: draft.auth,
      skipCertificateVerification: settings.skipCertificateVerification,
    }),
  )
  try {
    const result = (await ipc.invoke(
      'spaces:http:ws-connect',
      payload,
    )) as WsView
    if (ownToken !== token) {
      void ipc
        .invoke('spaces:http:ws-dispose', { connectionId: id })
        .catch(() => {})
      return
    }
    view.value = result
    timer = setInterval(() => void poll(ownToken, id), 200)
    await poll(ownToken, id)
  }
  catch (cause) {
    if (ownToken === token) {
      error.value = errorCode(cause)
      if (view.value)
        view.value = { ...view.value, state: 'error' }
    }
  }
}

async function adopt(receipt: AiHttpWebSocketReceipt, capturedToken = token) {
  const id = receipt.connectionId
  if (connectionId === id)
    return true
  if (
    capturedToken !== token
    || (httpState.activePanel !== undefined
      && httpState.activePanel !== 'request')
    || httpState.requestId !== receipt.requestId
    || currentRequest.value?.id !== receipt.requestId
    || !isWebSocket.value
    || activeEnvironmentId.value !== receipt.environmentId
    || isCurrentRequestLoading.value
    || currentRequest.value.pendingCloudDownload
  ) {
    await ipc.invoke('spaces:http:ws-dispose', { connectionId: id })
    return false
  }
  dispose()
  const ownToken = token
  connectionId = id
  view.value = {
    connectionId: id,
    state: 'connecting',
    messages: [],
    lastId: 0,
    dropped: 0,
  }
  timer = setInterval(() => void poll(ownToken, id), 200)
  await poll(ownToken, id)
  return ownToken === token && !error.value
}

function captureAdoption() {
  const capturedToken = token
  return (receipt: AiHttpWebSocketReceipt) => adopt(receipt, capturedToken)
}

async function disconnect() {
  const id = connectionId
  if (!id || !active.value)
    return
  const ownToken = token
  try {
    await ipc.invoke('spaces:http:ws-disconnect', { connectionId: id })
  }
  catch (cause) {
    if (ownToken === token)
      error.value = errorCode(cause)
  }
}

async function send() {
  if (!connectionId || view.value?.state !== 'open' || sending.value)
    return
  const ownToken = token
  error.value = null
  sending.value = true
  try {
    await ipc.invoke('spaces:http:ws-send', {
      connectionId,
      text: currentDraft.value?.body ?? '',
    })
  }
  catch (cause) {
    if (ownToken === token)
      error.value = errorCode(cause)
  }
  finally {
    if (ownToken === token)
      sending.value = false
  }
}

async function clear() {
  if (!connectionId || clearing)
    return
  const ownToken = token
  const id = connectionId
  // A poll already in flight may return older rows; drop it before clearing.
  ++logToken
  clearing = true
  try {
    const lastId = (await ipc.invoke('spaces:http:ws-clear', {
      connectionId: id,
    })) as number
    if (token !== ownToken || !view.value)
      return
    view.value = { ...view.value, messages: [], lastId, dropped: 0 }
  }
  catch (cause) {
    if (token === ownToken)
      error.value = errorCode(cause)
  }
  finally {
    if (token === ownToken)
      clearing = false
  }
}

export function useHttpWebSocket() {
  return {
    view,
    error,
    sending,
    isWebSocket,
    active,
    connect,
    adopt,
    captureAdoption,
    disconnect,
    send,
    clear,
    dispose,
  }
}
