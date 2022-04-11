import type { NotificationRequest } from '@shared/types/main'
import { ipcMain, Notification } from 'electron'

export const subscribeToNotification = () => {
  if (!Notification.isSupported()) return

  ipcMain.handle<NotificationRequest>('main:notification', (event, payload) => {
    return new Promise(resolve => {
      const { body } = payload
      const notification = new Notification({
        title: 'massCode',
        body
      })
      notification.show()
      resolve()
    })
  })
}
