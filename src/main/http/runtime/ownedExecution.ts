import type { WebContents } from 'electron'
import type { HttpHistorySnapshot } from '../../../shared/httpHistory'
import type { HttpExecutePayload } from '../../types/http'
import { executeHttpRequest } from './execute'
import { beginHttpExecution, finishHttpExecution } from './session'

const executions = new Map<number, AbortController>()
export function cancelOwnedHttpExecution(ownerId: number) {
  executions.get(ownerId)?.abort()
}
export async function executeOwnedHttpRequest(
  owner: WebContents,
  payload: HttpExecutePayload,
  signal?: AbortSignal,
  onSnapshot?: (snapshot: HttpHistorySnapshot) => void,
) {
  if (!beginHttpExecution())
    throw new Error('HTTP_REQUEST_RUNNING')
  const controller = new AbortController()
  const abort = () => controller.abort()
  const navigation = (
    _event: unknown,
    _url: string,
    inPlace: boolean,
    mainFrame: boolean,
  ) => {
    if (mainFrame && !inPlace)
      abort()
  }
  executions.set(owner.id, controller)
  owner.once('destroyed', abort)
  owner.on('did-start-navigation', navigation)
  try {
    return await executeHttpRequest(
      payload,
      undefined,
      signal ? AbortSignal.any([signal, controller.signal]) : controller.signal,
      onSnapshot,
    )
  }
  finally {
    owner.removeListener('destroyed', abort)
    owner.removeListener('did-start-navigation', navigation)
    executions.delete(owner.id)
    finishHttpExecution()
  }
}
