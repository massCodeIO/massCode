/* eslint-disable node/prefer-global/process */
import type { MenuConfig } from './utils'
import os from 'node:os'
import {
  app,
  BrowserWindow,
  dialog,
  type MenuItemConstructorOptions,
} from 'electron'
import i18n from '../i18n'
import { send } from '../ipc'
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
]

const editorMenuItems: MenuConfig[] = [
  {
    label: i18n.t('menu:editor.format'),
    accelerator: 'Shift+CommandOrControl+F',
    click: () => send('main-menu:format'),
  },
]

const menuItems: MenuItemConstructorOptions[] = [
  {
    label: i18n.t('menu:app.label'),
    submenu: createPlatformMenuItems(appMenuItems),
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
    role: 'windowMenu',
  },
  {
    label: i18n.t('menu:help.label'),
    submenu: createPlatformMenuItems(helpMenuItems),
  },
]

export const mainMenu = createMenu(menuItems)
