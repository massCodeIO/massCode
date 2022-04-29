import type { PrettierRequest } from '@shared/types/main'
import { ipcMain } from 'electron'
import { format } from '../prettier'

export const subscribeToPrettier = () => {
  ipcMain.handle<PrettierRequest, string>('main:prettier', (event, payload) => {
    const { source, parser } = payload
    return new Promise(resolve => {
      const formatted = format(source, parser)
      resolve(formatted)
    })
  })
}
