import { ipcMain } from 'electron'
import {
  httpRunPrepareSchema,
  httpRunStartSchema,
} from '../../../shared/httpRunner'
import {
  cancelHttpRun,
  disposeHttpRun,
  getHttpRun,
  prepareHttpRun,
  startHttpRun,
} from '../../http/runtime/runner'

const owners = new WeakSet<Electron.WebContents>()

export function registerHttpRunnerHandlers() {
  ipcMain.handle('spaces:http:run-prepare', (event, payload: unknown) => {
    const { folderId } = httpRunPrepareSchema.parse(payload)
    const sender = event.sender
    const ownerId = sender.id
    if (!owners.has(sender)) {
      owners.add(sender)
      sender.once('destroyed', () => disposeHttpRun(ownerId))
      sender.on(
        'did-start-navigation',
        (_event, _url, isInPlace, isMainFrame) => {
          if (isMainFrame && !isInPlace)
            disposeHttpRun(ownerId)
        },
      )
    }
    return prepareHttpRun(ownerId, folderId)
  })
  ipcMain.handle('spaces:http:run-start', (event, payload: unknown) =>
    startHttpRun(event.sender.id, httpRunStartSchema.parse(payload)))
  ipcMain.handle('spaces:http:run-status', (event, runId: string) =>
    getHttpRun(event.sender.id, runId))
  ipcMain.handle('spaces:http:run-cancel', (event, runId: string) =>
    cancelHttpRun(event.sender.id, runId))
  ipcMain.handle('spaces:http:run-dispose', event =>
    disposeHttpRun(event.sender.id))
}
