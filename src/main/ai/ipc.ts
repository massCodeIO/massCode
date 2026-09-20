import type { IpcMainInvokeEvent, WebContents } from 'electron'
import type { AiEvent, AiResult, AiStart } from '../../shared/ai'
import {
  AI_LIMITS,
  aiCancelSchema,
  aiConfigureSchema,
  aiStartSchema,
} from '../../shared/ai'
import { isTrustedApiRequest } from '../api/requestIpc'
import { listAiModels, streamAiChat } from './client'
import { AiError, aiErrorCode } from './errors'
import { configureAi, getAiConnection, getAiSettings } from './settings'

export function registerAiHandlers(owner: WebContents, rendererUrl: string) {
  let active: { requestId: string, controller: AbortController } | undefined
  const modelControllers = new Set<AbortController>()
  function send(event: AiEvent) {
    if (!owner.isDestroyed())
      owner.send('system:ai:event', event)
  }
  function cancelActive() {
    const previous = active
    if (!previous)
      return
    active = undefined
    previous.controller.abort()
    send({ requestId: previous.requestId, type: 'cancelled' })
  }
  function cleanup() {
    cancelActive()
    for (const controller of modelControllers) controller.abort()
    modelControllers.clear()
  }
  owner.on('did-start-navigation', (_event, _url, isInPlace, isMainFrame) => {
    if (isMainFrame && !isInPlace)
      cleanup()
  })
  owner.once('destroyed', cleanup)

  function handle<T>(
    channel: string,
    action: (payload: unknown) => T | Promise<T>,
  ) {
    owner.ipc.handle(
      channel,
      async (
        event: IpcMainInvokeEvent,
        payload: unknown,
      ): Promise<AiResult<T>> => {
        if (!isTrustedApiRequest(event, owner, rendererUrl))
          return { ok: false, error: 'unauthorized' }
        try {
          return { ok: true, data: await action(payload) }
        }
        catch (error) {
          return { ok: false, error: aiErrorCode(error) }
        }
      },
    )
  }
  handle('system:ai:settings', getAiSettings)
  handle('system:ai:configure', (payload) => {
    const parsed = aiConfigureSchema.safeParse(payload)
    if (!parsed.success)
      throw new AiError('invalidRequest')
    cancelActive()
    return configureAi(parsed.data)
  })
  handle('system:ai:models', async () => {
    const controller = new AbortController()
    modelControllers.add(controller)
    const timeout = AbortSignal.timeout(30_000)
    try {
      return await listAiModels(
        getAiConnection(),
        AbortSignal.any([controller.signal, timeout]),
      )
    }
    catch (error) {
      if (timeout.aborted)
        throw new AiError('timeout')
      throw error
    }
    finally {
      modelControllers.delete(controller)
    }
  })
  async function run(
    request: AiStart,
    session: NonNullable<typeof active>,
    connection: ReturnType<typeof getAiConnection>,
  ) {
    const timeout = AbortSignal.timeout(AI_LIMITS.timeoutMs)
    try {
      await streamAiChat(
        connection,
        request.messages,
        AbortSignal.any([session.controller.signal, timeout]),
        (text) => {
          if (active === session)
            send({ requestId: request.requestId, type: 'delta', text })
        },
      )
      if (active === session)
        send({ requestId: request.requestId, type: 'done' })
    }
    catch (error) {
      if (active === session) {
        send({
          requestId: request.requestId,
          type: 'error',
          error: timeout.aborted ? 'timeout' : aiErrorCode(error),
        })
      }
    }
    finally {
      if (active === session)
        active = undefined
    }
  }
  handle('system:ai:start', (payload) => {
    const parsed = aiStartSchema.safeParse(payload)
    if (!parsed.success)
      throw new AiError('invalidRequest')
    if (active)
      throw new AiError('busy')
    const connection = getAiConnection()
    const session = {
      requestId: parsed.data.requestId,
      controller: new AbortController(),
    }
    active = session
    void run(parsed.data, session, connection)
    return { requestId: parsed.data.requestId }
  })
  handle('system:ai:cancel', (payload) => {
    const parsed = aiCancelSchema.safeParse(payload)
    if (!parsed.success)
      throw new AiError('invalidRequest')
    if (active?.requestId === parsed.data.requestId)
      cancelActive()
    return null
  })
}
