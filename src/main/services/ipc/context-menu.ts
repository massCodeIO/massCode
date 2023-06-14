import { createMenu } from '../../components/menu'
import type { MenuItemConstructorOptions } from 'electron'
import { BrowserWindow, MenuItem, dialog, ipcMain } from 'electron'
import type {
  ContextMenuRequest,
  ContextMenuResponse
} from '@shared/types/main'
import { languages } from '../../../renderer/components/editor/languages'
import i18n from '../i18n'

export const subscribeToContextMenu = () => {
  ipcMain.handle<ContextMenuRequest, ContextMenuResponse>(
    'context-menu:snippet-fragment',
    async (event, payload) => {
      const { name, type } = payload

      return new Promise(resolve => {
        const menu = createMenu([
          {
            label: `${i18n.t('rename')} ${name}`,
            click: () =>
              resolve({
                action: 'rename',
                type,
                data: payload
              })
          },
          { type: 'separator' },
          {
            label: `${i18n.t('delete')} ${name}`,
            click: () => {
              const buttonId = dialog.showMessageBoxSync(
                BrowserWindow.getFocusedWindow()!,
                {
                  message: i18n.t('dialog:deleteConfirm', { name }),
                  detail: i18n.t('dialog:noUndo'),
                  buttons: [i18n.t('button.confirm'), i18n.t('button.cancel')],
                  defaultId: 0,
                  cancelId: 1
                }
              )
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

        menu.popup({ window: BrowserWindow.getFocusedWindow()! })
      })
    }
  )

  ipcMain.handle<ContextMenuRequest, ContextMenuResponse>(
    'context-menu:snippet',
    async (event, payload) => {
      const { name, type, selectedCount } = payload

      return new Promise(resolve => {
        const menu = createMenu([])

        const defaultMenu: MenuItemConstructorOptions[] = [
          {
            label: i18n.t('addToFavorites'),
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
            label: i18n.t('copy-snippet-link'),
            click: () => {
              resolve({
                action: 'copy-snippet-link',
                type,
                data: true
              })
            }
          },
          { type: 'separator' },
          {
            label: i18n.t('duplicate'),
            click: () => {
              resolve({
                action: 'duplicate',
                type,
                data: undefined
              })
            }
          },
          {
            label: i18n.t('delete'),
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
            label: i18n.t('removeFromFavorites'),
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
            label: i18n.t('delete'),
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
            label: i18n.t('deleteNow'),
            click: () => {
              const message =
                selectedCount === 0
                  ? i18n.t('dialog:deleteConfirm', { name })
                  : i18n.t('dialog:deleteConfirmMultipleSnippets', {
                    count: selectedCount
                  })
              const buttonId = dialog.showMessageBoxSync(
                BrowserWindow.getFocusedWindow()!,
                {
                  message,
                  detail: i18n.t('dialog:noUndo'),
                  buttons: [i18n.t('button.confirm'), i18n.t('button.cancel')],
                  defaultId: 0,
                  cancelId: 1
                }
              )

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
          {
            label: i18n.t('restore'),
            click: () => {
              resolve({
                action: 'restore-from-trash',
                type,
                data: undefined
              })
            }
          }
        ]

        if (type === 'folder' || type === 'all' || type === 'inbox') {
          defaultMenu.forEach(i => {
            menu.append(new MenuItem(i))
          })
          menu.popup({ window: BrowserWindow.getFocusedWindow()! })
        }

        if (type === 'favorites') {
          favoritesMenu.forEach(i => {
            menu.append(new MenuItem(i))
          })
          menu.popup({ window: BrowserWindow.getFocusedWindow()! })
        }

        if (type === 'trash') {
          trashMenu.forEach(i => {
            menu.append(new MenuItem(i))
          })
          menu.popup({ window: BrowserWindow.getFocusedWindow()! })
        }

        menu.on('menu-will-close', () => {
          BrowserWindow.getFocusedWindow()?.webContents.send(
            'context-menu:close'
          )
        })
      })
    }
  )

  ipcMain.handle<ContextMenuRequest, ContextMenuResponse>(
    'context-menu:library',
    async (event, payload) => {
      const { name, type, data } = payload

      return new Promise(resolve => {
        const menu = createMenu([])

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

        const folderMenu: MenuItemConstructorOptions[] = [
          {
            label: i18n.t('newFolder'),
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
            label: i18n.t('rename'),
            click: () => {
              resolve({
                action: 'rename',
                type,
                data: payload
              })
            }
          },
          {
            label: i18n.t('delete'),
            click: () => {
              const buttonId = dialog.showMessageBoxSync(
                BrowserWindow.getFocusedWindow()!,
                {
                  message: i18n.t('dialog:deleteConfirm', { name }),
                  detail: i18n.t('dialog:allSnippetsMoveToTrash'),
                  buttons: [i18n.t('delete'), i18n.t('button.cancel')],
                  defaultId: 0,
                  cancelId: 1
                }
              )

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
            label: i18n.t('collapse-all'),
            click: () => {
              resolve({
                action: 'collapse-all',
                type,
                data: undefined
              })
            }
          },
          {
            label: i18n.t('expand-all'),
            click: () => {
              resolve({
                action: 'expand-all',
                type,
                data: undefined
              })
            }
          },
          { type: 'separator' },
          {
            label: i18n.t('defaultLanguage'),
            submenu: createLanguageMenu()
          },
          { type: 'separator' },
          {
            label: i18n.t('set-custom-icon'),
            click: () => {
              resolve({
                action: 'set-custom-icon',
                type,
                data: undefined
              })
            }
          }
        ]

        const tagMenu: MenuItemConstructorOptions[] = [
          {
            label: i18n.t('delete'),
            click: () => {
              const buttonId = dialog.showMessageBoxSync(
                BrowserWindow.getFocusedWindow()!,
                {
                  message: i18n.t('dialog:deleteConfirm', { name }),
                  detail: i18n.t('dialog:deleteTag'),
                  buttons: [i18n.t('delete'), i18n.t('button.cancel')],
                  defaultId: 0,
                  cancelId: 1
                }
              )

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

        const trashMenu: MenuItemConstructorOptions[] = [
          {
            label: i18n.t('emptyTrash'),
            click: () => {
              const buttonId = dialog.showMessageBoxSync(
                BrowserWindow.getFocusedWindow()!,
                {
                  message: i18n.t('dialog:emptyTrash'),
                  detail: i18n.t('dialog:noUndo'),
                  buttons: [i18n.t('delete'), i18n.t('button.cancel')],
                  defaultId: 0,
                  cancelId: 1
                }
              )

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

        if (type === 'folder') {
          folderMenu.forEach(i => {
            menu.append(new MenuItem(i))
          })
          menu.popup({ window: BrowserWindow.getFocusedWindow()! })
        }

        if (type === 'tag') {
          tagMenu.forEach(i => {
            menu.append(new MenuItem(i))
          })
          menu.popup({ window: BrowserWindow.getFocusedWindow()! })
        }

        if (type === 'trash') {
          trashMenu.forEach(i => {
            menu.append(new MenuItem(i))
          })
          menu.popup({ window: BrowserWindow.getFocusedWindow()! })
        }

        menu.on('menu-will-close', () => {
          BrowserWindow.getFocusedWindow()?.webContents.send(
            'context-menu:close'
          )
        })
      })
    }
  )
}
