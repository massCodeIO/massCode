import type {
  WsConnect,
  WsMessage,
  WsView,
} from '../../../shared/httpWebSocket'
import { Buffer } from 'node:buffer'
import WebSocket from 'ws'
import {
  applyHttpCollection,
  collectionVariables,
} from '../../../shared/httpCollection'
import {
  interpolateHttpVariables,
  maskHttpSecretVariables,
} from '../../../shared/httpVariables'
import {
  WS_LOG_LIMIT,
  WS_MESSAGE_LIMIT,
  WS_PREVIEW_LIMIT,
} from '../../../shared/httpWebSocket'
import { useHttpStorage } from '../../storage'
import { getVaultPath } from '../../storage/providers/markdown/runtime/paths'
import { resolveHttpCollection } from '../collection'
import { applyAuth, resolveEnvironment } from '../runtime/execute'
import { getHttpSession, isHttpSessionCurrent } from '../runtime/session'

interface Connection {
  socket: WebSocket
  view: WsView
  variables: Record<string, string>
  maskedVariables: Record<string, string>
  current: () => boolean
  timer?: ReturnType<typeof setInterval>
  closeTimer?: ReturnType<typeof setTimeout>
}
const connections = new Map<number, Connection>()

function owned(owner: number, id: string) {
  const connection = connections.get(owner)
  if (!connection || connection.view.connectionId !== id)
    throw new Error('WS_UNAVAILABLE')
  return connection
}

function release(connection: Connection) {
  clearInterval(connection.timer)
  clearTimeout(connection.closeTimer)
  connection.variables = {}
  connection.maskedVariables = {}
}

function checkContext(connection: Connection) {
  if (connection.current())
    return true
  connection.view.error = 'contextChanged'
  connection.view.state = 'closed'
  release(connection)
  connection.socket.terminate()
  return false
}

function append(
  connection: Connection,
  direction: WsMessage['direction'],
  data: Buffer,
  binary: boolean,
  display?: string,
) {
  const text
    = display
      ?? (binary
        ? data.subarray(0, WS_PREVIEW_LIMIT).toString('base64')
        : data.toString('utf8'))
  connection.view.messages.push({
    id: ++connection.view.lastId,
    time: Date.now(),
    direction,
    kind: binary ? 'binary' : 'text',
    bytes: data.length,
    text: text.slice(0, WS_PREVIEW_LIMIT),
    truncated: data.length > WS_PREVIEW_LIMIT || text.length > WS_PREVIEW_LIMIT,
  })
  if (connection.view.messages.length > WS_LOG_LIMIT) {
    connection.view.messages.shift()
    connection.view.dropped++
  }
}

export function connectWebSocket(owner: number, input: WsConnect): WsView {
  const storage = useHttpStorage()
  const saved = storage.requests.getRequestById(input.requestId)
  if (!saved || saved.isDeleted || saved.pendingCloudDownload)
    throw new Error('WS_UNAVAILABLE')
  if (storage.environments.getActiveEnvironmentId() !== input.environmentId)
    throw new Error('WS_CONTEXT_CHANGED')
  const vault = getVaultPath()
  const session = getHttpSession(vault, input.environmentId)
  const config = resolveHttpCollection(saved.folderId)?.config
  input = applyHttpCollection(input, config)
  const environment = resolveEnvironment(input.environmentId)
  const variables = {
    ...collectionVariables(config),
    ...environment.variables,
    ...session.variables,
  }
  const maskedVariables = {
    ...collectionVariables(config),
    ...environment.maskedVariables,
    ...maskHttpSecretVariables(session.variables, session.names),
  }
  const interpolate = (value: string) =>
    interpolateHttpVariables(value, variables)
  let url: URL
  let headers: Record<string, string>
  try {
    url = new URL(interpolate(input.url))
    if (
      !['ws:', 'wss:'].includes(url.protocol)
      || url.username
      || url.password
      || url.hash
    ) {
      throw new Error('invalid')
    }
    if (input.query.length)
      url.search = ''
    for (const q of input.query) {
      if (q.enabled !== false && q.key)
        url.searchParams.append(interpolate(q.key), interpolate(q.value))
    }
    const auth = {
      ...input.auth,
      token: interpolate(input.auth.token ?? ''),
      username: interpolate(input.auth.username ?? ''),
      password: interpolate(input.auth.password ?? ''),
    }
    headers = Object.fromEntries(
      applyAuth(
        auth,
        input.headers
          .filter(h => h.enabled !== false)
          .map(h => ({
            key: interpolate(h.key).toLowerCase(),
            value: interpolate(h.value),
          })),
      ).map(h => [h.key.toLowerCase(), h.value]),
    )
    // The transport owns handshake framing and subprotocol negotiation.
    for (const key of Object.keys(headers)) {
      if (
        [
          'host',
          'connection',
          'upgrade',
          'content-length',
          'transfer-encoding',
        ].includes(key)
        || key.startsWith('sec-websocket-')
      ) {
        throw new Error('invalid')
      }
    }
    if (/\{\{.*?\}\}/.test(decodeURI(url.toString())))
      throw new Error('invalid')
  }
  catch {
    throw new Error('WS_INVALID')
  }
  disposeWebSocket(owner)
  let socket: WebSocket
  try {
    socket = new WebSocket(url, {
      headers,
      handshakeTimeout: 15000,
      maxPayload: WS_MESSAGE_LIMIT,
      perMessageDeflate: false,
      followRedirects: false,
      rejectUnauthorized: !input.skipCertificateVerification,
    })
  }
  catch {
    throw new Error('WS_INVALID')
  }
  const connection: Connection = {
    socket,
    variables,
    maskedVariables,
    view: {
      connectionId: input.connectionId,
      state: 'connecting',
      messages: [],
      lastId: 0,
      dropped: 0,
    },
    current: () => {
      try {
        return (
          getVaultPath() === vault
          && storage.environments.getActiveEnvironmentId()
          === input.environmentId
          && isHttpSessionCurrent(session.generation)
        )
      }
      catch {
        return false
      }
    },
  }
  connections.set(owner, connection)
  connection.timer = setInterval(() => checkContext(connection), 200)
  connection.timer.unref()
  socket.on('open', () => {
    if (checkContext(connection))
      connection.view.state = 'open'
  })
  socket.on('message', (data, binary) => {
    if (connection.view.state !== 'open' || !checkContext(connection))
      return
    const buffer = Array.isArray(data)
      ? Buffer.concat(data)
      : Buffer.from(data as Buffer)
    append(connection, 'incoming', buffer, binary)
  })
  socket.on('error', (error: NodeJS.ErrnoException) => {
    if (['closing', 'closed', 'error'].includes(connection.view.state))
      return
    connection.view.error
      = error.code === 'WS_ERR_UNSUPPORTED_MESSAGE_LENGTH'
        ? 'tooLarge'
        : 'network'
    connection.view.state = 'error'
    release(connection)
    socket.terminate()
  })
  socket.on('unexpected-response', (request, response) => {
    connection.view.error = 'handshake'
    connection.view.handshakeStatus = response.statusCode
    connection.view.state = 'error'
    release(connection)
    // Do not expose server bodies, headers or credentials in connection errors.
    response.destroy()
    request.destroy()
    socket.terminate()
  })
  socket.on('close', (code) => {
    if (connection.view.state !== 'error')
      connection.view.state = 'closed'
    connection.view.closeCode = code
    release(connection)
  })
  return structuredClone(connection.view)
}

export function readWebSocket(
  owner: number,
  id: string,
  after: number,
): WsView {
  const connection = owned(owner, id)
  if (['connecting', 'open'].includes(connection.view.state))
    checkContext(connection)
  return structuredClone({
    ...connection.view,
    messages: connection.view.messages.filter(m => m.id > after),
  })
}

export async function sendWebSocket(owner: number, id: string, text: string) {
  const connection = owned(owner, id)
  if (!checkContext(connection))
    throw new Error('WS_CONTEXT_CHANGED')
  if (connection.socket.readyState !== WebSocket.OPEN)
    throw new Error('WS_NOT_OPEN')
  const actual = interpolateHttpVariables(text, connection.variables)
  const data = Buffer.from(actual)
  if (data.length > WS_MESSAGE_LIMIT)
    throw new Error('WS_TOO_LARGE')
  if (connection.socket.bufferedAmount > WS_MESSAGE_LIMIT)
    throw new Error('WS_BUSY')
  const display = interpolateHttpVariables(text, connection.maskedVariables)
  await new Promise<void>((resolve, reject) =>
    connection.socket.send(data, { binary: false }, error =>
      error ? reject(new Error('WS_NETWORK')) : resolve()),
  )
  if (connection.view.state === 'open' && checkContext(connection))
    append(connection, 'outgoing', data, false, display)
}

export function disconnectWebSocket(owner: number, id: string) {
  const connection = owned(owner, id)
  if (!['open', 'connecting'].includes(connection.view.state))
    return
  connection.view.state = 'closing'
  release(connection)
  if (connection.socket.readyState === WebSocket.CONNECTING)
    connection.socket.terminate()
  else connection.socket.close(1000)
  connection.closeTimer = setTimeout(() => connection.socket.terminate(), 1000)
  connection.closeTimer.unref()
}

export function clearWebSocket(owner: number, id: string) {
  const connection = owned(owner, id)
  connection.view.messages = []
  connection.view.dropped = 0
  return connection.view.lastId
}

export function disposeWebSocket(owner: number, id?: string) {
  const connection = connections.get(owner)
  if (!connection || (id && connection.view.connectionId !== id))
    return
  connection.view.state = 'closed'
  release(connection)
  connection.view.messages = []
  connection.socket.terminate()
  connections.delete(owner)
}
