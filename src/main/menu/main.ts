/* eslint-disable node/prefer-global/process */
import type { MenuConfig } from './utils'
import os from 'node:os'
import {
  app,
  BrowserWindow,
  dialog,
  type MenuItemConstructorOptions,
  shell,
} from 'electron'
import { repository } from '../../../package.json'
import i18n from '../i18n'
import { send } from '../ipc'
import { fethUpdates } from '../updates'
import { createMenu, createPlatformMenuItems } from './utils'

const year = new Date().getFullYear()
const version = app.getVersion()

const isDev = process.env.NODE_ENV === 'development'

function aboutApp() {
  dialog.showMessageBox(BrowserWindow.getFocusedWindow()!, {
    title: 'massCode',
    message: 'massCode',
    type: 'info',
    detail: `
      Version: ${version}
      Electron: ${process.versions.electron}
      Chrome: ${process.versions.chrome}
      Node.js: ${process.versions.node}
      V8: ${process.versions.v8}
      OS: ${os.type()} ${os.arch()} ${os.release()}
      ©2019-${year} Anton Reshetov <reshetov.art@gmail.com>
    `,
  })
}

const appMenuItems: MenuConfig[] = [
  {
    id: 'about',
    label: i18n.t('menu:app.about'),
    platforms: ['darwin'],
    click: () => aboutApp(),
  },
  {
    id: 'update',
    label: i18n.t('menu:app.update'),
    click: async () => {
      const latestVersion = await fethUpdates()

      if (latestVersion) {
        const buttonId = dialog.showMessageBoxSync(
          BrowserWindow.getFocusedWindow()!,
          {
            message: i18n.t('messages:update.available', {
              newVersion: latestVersion,
              oldVersion: version,
            }),
            buttons: [i18n.t('button.update.0'), i18n.t('button.update.1')],
            defaultId: 0,
            cancelId: 1,
          },
        )

        if (buttonId === 0) {
          shell.openExternal(`${repository}/releases`)
        }
      }
      else {
        dialog.showMessageBoxSync(BrowserWindow.getFocusedWindow()!, {
          message: i18n.t('messages:update.noAvailable'),
        })
      }
    },
  },
  {
    type: 'separator',
  },
  {
    id: 'preferences',
    label: i18n.t('menu:app.preferences'),
    accelerator: 'CommandOrControl+,',
    click: () => send('main-menu:goto-preferences'),
  },
  {
    type: 'separator' as any,
    platforms: ['darwin'],
  },
  {
    id: 'devtools',
    label: i18n.t('menu:app.devtools'),
    accelerator: 'CommandOrControl+.',
    click: () => send('main-menu:goto-devtools'),
  },
  {
    type: 'separator' as any,
  },
  {
    label: i18n.t('menu:app.hide'),
    platforms: ['darwin'],
    role: 'hide',
  },
  {
    platforms: ['darwin'],
    role: 'hideOthers',
  },
  {
    platforms: ['darwin'],
    role: 'unhide',
  },
  {
    type: 'separator' as any,
    platforms: ['darwin'],
  },
  {
    label: i18n.t('menu:app.quit'),
    platforms: ['darwin'],
    role: 'quit',
  },
]

const helpMenuItems: MenuConfig[] = [
  {
    id: 'about',
    label: i18n.t('menu:app.about'),
    click: () => aboutApp(),
  },
  {
    label: i18n.t('menu:help.devTools'),
    role: 'toggleDevTools',
  },
]

if (isDev) {
  helpMenuItems.push({
    label: 'Reload',
    role: 'reload',
  })
}

const fileMenuItems: MenuConfig[] = [
  {
    label: i18n.t('action.new.snippet'),
    click: () => send('main-menu:new-snippet'),
    accelerator: 'CommandOrControl+N',
  },
  {
    label: i18n.t('action.new.fragment'),
    click: () => send('main-menu:new-fragment'),
    accelerator: 'CommandOrControl+T',
  },
  {
    label: i18n.t('action.add.description'),
    click: () => send('main-menu:add-description'),
    accelerator: 'CommandOrControl+Shift+T',
  },
  {
    type: 'separator',
  },
  {
    label: i18n.t('action.new.folder'),
    click: () => send('main-menu:new-folder'),
    accelerator: 'CommandOrControl+Shift+N',
  },
]

const editMenuItems: MenuConfig[] = [
  {
    role: 'undo',
  },
  {
    role: 'redo',
  },
  {
    type: 'separator',
  },
  {
    role: 'cut',
  },
  {
    role: 'copy',
  },
  {
    role: 'paste',
  },
  {
    role: 'delete',
  },
  {
    type: 'separator',
  },
  {
    role: 'selectAll',
  },
  {
    type: 'separator',
  },
  {
    label: i18n.t('menu:edit.find'),
    accelerator: 'CommandOrControl+F',
    click: () => send('main-menu:find'),
  },
]

const editorMenuItems: MenuConfig[] = [
  {
    label: i18n.t('menu:editor.copy'),
    click: () => send('main-menu:copy-snippet'),
    accelerator: 'CommandOrControl+Shift+C',
  },
  {
    label: i18n.t('menu:editor.format'),
    accelerator: 'Shift+CommandOrControl+F',
    click: () => send('main-menu:format'),
  },
  {
    label: i18n.t('menu:editor.previewCode'),
    click: () => send('main-menu:preview-code'),
    accelerator: 'Alt+CommandOrControl+P',
  },
  {
    type: 'separator',
  },
  {
    label: i18n.t('menu:editor.fontSizeIncrease'),
    accelerator: 'CommandOrControl+=',
    click: () => send('main-menu:font-size-increase'),
  },
  {
    label: i18n.t('menu:editor.fontSizeDecrease'),
    accelerator: 'CommandOrControl+-',
    click: () => send('main-menu:font-size-decrease'),
  },
  {
    label: i18n.t('menu:editor.fontSizeReset'),
    accelerator: 'CommandOrControl+0',
    click: () => send('main-menu:font-size-reset'),
  },
]

const markdownMenuItems: MenuConfig[] = [
  {
    label: i18n.t('menu:markdown.preview'),
    click: () => send('main-menu:preview-markdown'),
    accelerator: 'CommandOrControl+Shift+M',
  },
  {
    label: i18n.t('menu:markdown.previewMindmap'),
    click: () => send('main-menu:preview-mindmap'),
    accelerator: 'CommandOrControl+Shift+I',
  },
  {
    type: 'separator',
  },
  {
    label: i18n.t('menu:markdown.presentationMode'),
    click: () => send('main-menu:presentation-mode'),
    accelerator: 'CommandOrControl+Shift+P',
  },
]

const menuItems: MenuItemConstructorOptions[] = [
  {
    label: i18n.t('menu:app.label'),
    submenu: createPlatformMenuItems(appMenuItems),
  },
  {
    label: 'File',
    submenu: createPlatformMenuItems(fileMenuItems),
  },
  {
    role: 'editMenu',
    submenu: createPlatformMenuItems(editMenuItems),
  },
  {
    label: i18n.t('menu:editor.label'),
    submenu: createPlatformMenuItems(editorMenuItems),
  },
  {
    label: i18n.t('menu:markdown.label'),
    submenu: createPlatformMenuItems(markdownMenuItems),
  },
  {
    role: 'windowMenu',
  },
  {
    label: i18n.t('menu:help.label'),
    submenu: createPlatformMenuItems(helpMenuItems),
  },
]

export const mainMenu = createMenu(menuItems)
