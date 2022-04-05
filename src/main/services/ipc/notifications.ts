import type { NotificationPayload } from '@shared/types/main'
import { ipcMain, Notification } from 'electron'

export const subscribeToNotification = () => {
  if (!Notification.isSupported()) return

  ipcMain.handle<NotificationPayload>('notification', (event, payload) => {
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
