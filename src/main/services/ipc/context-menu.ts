import { createPopupMenu } from '../../components/menu'
import { dialog, ipcMain } from 'electron'
import type { ContextMenuPayload, ContextMenuResponse } from '../../types'

export const subscribeToContextMenu = () => {
  ipcMain.handle<ContextMenuPayload, ContextMenuResponse>(
    'context-menu:snippet-fragment',
    async (event, payload) => {
      const { name } = payload

      return new Promise(resolve => {
        createPopupMenu([
          {
            label: `Rename "${name}"`,
            click: () =>
              resolve({
                action: 'rename',
                data: payload
              })
          },
          { type: 'separator' },
          {
            label: `Delete "${name}"`,
            click: () => {
              const buttonId = dialog.showMessageBoxSync({
                message: `Are you sure you want to permanently delete "${name}"?`,
                detail: 'You cannot undo this action.',
                buttons: ['Delete', 'Cancel'],
                defaultId: 0,
                cancelId: 1
              })
              if (buttonId === 0) {
                resolve({
                  action: 'delete',
                  data: payload
                })
              }
            }
          }
        ])
      })
    }
  )
}
