import { createMenu } from '../components/menu'
import type { MenuItemConstructorOptions } from 'electron'
import { app, BrowserWindow } from 'electron'
import { version, author } from '../../../package.json'

const isDev = process.env.NODE_ENV === 'development'
const isMac = process.platform === 'darwin'
const year = new Date().getFullYear()

if (isMac) {
  app.setAboutPanelOptions({
    applicationName: 'massCode',
    applicationVersion: version,
    version,
    copyright: `${author.name}\n https://masscode.io \n©2019-${year}`
  })
}

const appMenuCommon: Record<
'preferences' | 'quit',
MenuItemConstructorOptions
> = {
  preferences: {
    label: 'Preferences',
    accelerator: 'CommandOrControl+,',
    click: () => {
      console.log('ss')
      BrowserWindow.getFocusedWindow()?.webContents.send(
        'main-menu:preferences'
      )
    }
  },
  quit: {
    label: 'Quit massCode',
    role: 'quit'
  }
}

const appMenuMac: MenuItemConstructorOptions[] = [
  {
    label: 'About massCode',
    click: () => {
      app.showAboutPanel()
    }
  },
  {
    type: 'separator'
  },
  {
    ...appMenuCommon.preferences
  },
  {
    type: 'separator'
  },
  {
    label: 'Hide massCode',
    role: 'hide'
  },
  {
    label: 'Hide Others',
    role: 'hideOthers'
  },
  {
    label: 'Show All',
    role: 'unhide'
  },
  {
    type: 'separator'
  },
  {
    ...appMenuCommon.quit
  }
]

const appMenu: MenuItemConstructorOptions[] = [
  { ...appMenuCommon.preferences },
  { ...appMenuCommon.quit }
]

const helpMenu: MenuItemConstructorOptions[] = [
  {
    label: 'Toogle Dev tools',
    role: 'toggleDevTools'
  }
]

if (isDev) {
  helpMenu.push({
    label: 'Reload',
    role: 'reload'
  })
}

const menuItems: MenuItemConstructorOptions[] = [
  {
    label: 'massCode',
    submenu: isMac ? appMenuMac : appMenu
  },
  {
    label: 'Edit',
    role: 'editMenu'
  },
  {
    label: 'Help',
    submenu: helpMenu
  }
]

export const mainMenu = createMenu(menuItems)
