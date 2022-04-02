import { createPopupMenu } from '../../components/menu'
import type { MenuItemConstructorOptions } from 'electron'
import { Menu, MenuItem, dialog, ipcMain } from 'electron'
import type {
  ContextMenuAction,
  ContextMenuPayload,
  ContextMenuResponse
} from '../../types'

export const subscribeToContextMenu = () => {
  ipcMain.handle<ContextMenuPayload, ContextMenuResponse>(
    'context-menu:snippet-fragment',
    async (event, payload) => {
      const { name, type } = payload

      return new Promise(resolve => {
        createPopupMenu([
          {
            label: `Rename "${name}"`,
            click: () =>
              resolve({
                action: 'rename',
                type,
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
                  type,
                  data: payload
                })
              }
            }
          }
        ])
      })
    }
  )

  ipcMain.handle<ContextMenuPayload, ContextMenuResponse>(
    'context-menu:snippet',
    async (event, payload) => {
      const { name, type } = payload

      return new Promise(resolve => {
        const menu = createPopupMenu([])
        let action: ContextMenuAction = 'none'

        const defaultMenu: MenuItemConstructorOptions[] = [
          {
            label: 'Add to Favorites',
            click: () => {
              action = 'favorites'
              resolve({
                action,
                type,
                data: true
              })
            }
          },
          { type: 'separator' },
          {
            label: 'Duplicate',
            click: () => {
              action = 'duplicate'
              resolve({
                action,
                type,
                data: undefined
              })
            }
          },
          {
            label: 'Delete',
            click: () => {
              action = 'delete'
              resolve({
                action,
                type,
                data: undefined
              })
            }
          }
        ]

        const favoritesMenu: MenuItemConstructorOptions[] = [
          {
            label: 'Remove from Favorites',
            click: () => {
              action = 'favorites'
              resolve({
                action,
                type,
                data: false
              })
            }
          },
          { type: 'separator' },
          {
            label: 'Delete',
            click: () => {
              action = 'delete'
              resolve({
                action,
                type,
                data: undefined
              })
            }
          }
        ]

        const trashMenu: MenuItemConstructorOptions[] = [
          {
            label: 'Delete now',
            click: () => {
              action = 'delete'
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
                  type,
                  data: payload
                })
              }
            }
          }
        ]

        if (type === 'folder' || type === 'all' || type === 'inbox') {
          defaultMenu.forEach(i => {
            menu.append(new MenuItem(i))
          })
        }

        if (type === 'favorites') {
          favoritesMenu.forEach(i => {
            menu.append(new MenuItem(i))
          })
        }

        if (type === 'trash') {
          trashMenu.forEach(i => {
            menu.append(new MenuItem(i))
          })
        }

        menu.on('menu-will-close', async () => {
          setImmediate(() => {
            resolve({
              action,
              type,
              data: payload
            })
          })
        })
      })
    }
  )
}
