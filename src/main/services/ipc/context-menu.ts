import { createPopupMenu } from '../../components/menu'
import type { MenuItemConstructorOptions } from 'electron'
import { BrowserWindow, MenuItem, dialog, ipcMain } from 'electron'
import type { ContextMenuPayload, ContextMenuResponse } from '../../types'
import { languages } from '../../../renderer/components/editor/languages'

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

        const defaultMenu: MenuItemConstructorOptions[] = [
          {
            label: 'Add to Favorites',
            click: () => {
              resolve({
                action: 'favorites',
                type,
                data: true
              })
            }
          },
          { type: 'separator' },
          {
            label: 'Duplicate',
            click: () => {
              resolve({
                action: 'duplicate',
                type,
                data: undefined
              })
            }
          },
          {
            label: 'Delete',
            click: () => {
              resolve({
                action: 'delete',
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
              resolve({
                action: 'favorites',
                type,
                data: false
              })
            }
          },
          { type: 'separator' },
          {
            label: 'Delete',
            click: () => {
              resolve({
                action: 'delete',
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
                  data: undefined
                })
              } else {
                resolve({
                  action: 'none',
                  type,
                  data: undefined
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

        menu.on('menu-will-close', () => {
          BrowserWindow.getFocusedWindow()?.webContents.send(
            'context-menu:close'
          )
        })
      })
    }
  )

  ipcMain.handle<ContextMenuPayload, ContextMenuResponse>(
    'context-menu:folder',
    async (event, payload) => {
      const { name, type, data } = payload

      console.log(data.defaultLanguage)

      return new Promise(resolve => {
        const createLanguageMenu = () => {
          return languages.map(i => {
            return {
              label: i.name,
              type: 'radio',
              checked: i.value === data.defaultLanguage,
              click: () => {
                resolve({
                  action: 'update:language',
                  type,
                  data: i.value
                })
              }
            }
          }) as MenuItemConstructorOptions[]
        }

        const menu = createPopupMenu([
          {
            label: 'New folder',
            click: () => {
              resolve({
                action: 'new',
                type,
                data: undefined
              })
            }
          },
          { type: 'separator' },
          {
            label: 'Delete',
            click: () => {
              const buttonId = dialog.showMessageBoxSync({
                message: `Are you sure you want to delete "${name}"?`,
                detail: 'All snippets in this folder will be moved to trash.',
                buttons: ['Delete', 'Cancel'],
                defaultId: 0,
                cancelId: 1
              })

              if (buttonId === 0) {
                resolve({
                  action: 'delete',
                  type,
                  data: undefined
                })
              } else {
                resolve({
                  action: 'none',
                  type,
                  data: undefined
                })
              }
            }
          },
          { type: 'separator' },
          {
            label: 'Default Language',
            submenu: createLanguageMenu()
          }
        ])

        menu.on('menu-will-close', () => {
          BrowserWindow.getFocusedWindow()?.webContents.send(
            'context-menu:close'
          )
        })
      })
    }
  )
}
