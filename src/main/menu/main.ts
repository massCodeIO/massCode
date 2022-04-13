import { createMenu } from '../components/menu'
import type { MenuItemConstructorOptions } from 'electron'
import { shell, dialog, app, BrowserWindow } from 'electron'
import { version, author } from '../../../package.json'
import os from 'os'

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
    label: 'About',
    click () {
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
        `
      })
    }
  },
  {
    label: 'Website',
    click: () => {
      shell.openExternal('https://masscode.io')
    }
  },
  {
    label: 'Change Log',
    click: () => {
      shell.openExternal(
        'https://github.com/massCodeIO/massCode/blob/master/CHANGELOG.md'
      )
    }
  },
  {
    label: 'Documentation',
    click: () => {
      shell.openExternal('https://masscode.io/documentation')
    }
  },
  {
    label: 'View in GitHub',
    click: () => {
      shell.openExternal('https://github.com/massCodeIO/massCode')
    }
  },
  {
    label: 'Report Issue',
    click: () => {
      shell.openExternal(
        'https://github.com/massCodeIO/massCode/issues/new/choose'
      )
    }
  },
  {
    type: 'separator'
  },
  {
    label: 'Donate',
    click: () => {
      shell.openExternal('https://opencollective.com/masscode')
    }
  },
  {
    label: 'Twitter',
    click: () => {
      shell.openExternal('https://twitter.com/anton_reshetov')
    }
  },
  {
    type: 'separator'
  },
  {
    label: 'Toggle Developer Tools',
    role: 'toggleDevTools'
  }
]

if (isDev) {
  helpMenu.push({
    label: 'Reload',
    role: 'reload'
  })
}

const fileMenu: MenuItemConstructorOptions[] = [
  {
    label: 'New Snippet',
    accelerator: 'CommandOrControl+N',
    click: () => {
      BrowserWindow.getFocusedWindow()?.webContents.send(
        'main-menu:new-snippet'
      )
    }
  },
  {
    label: 'New Fragment',
    accelerator: 'CommandOrControl+T',
    click: () => {
      BrowserWindow.getFocusedWindow()?.webContents.send(
        'main-menu:new-fragment'
      )
    }
  },
  {
    label: 'New Folder',
    accelerator: 'CommandOrControl+Shift+N',
    click: () => {
      BrowserWindow.getFocusedWindow()?.webContents.send('main-menu:new-folder')
    }
  }
]

const editorMenu: MenuItemConstructorOptions[] = [
  {
    label: 'Copy Snippet to Clipboard',
    accelerator: 'Shift+CommandOrControl+C',
    click: () => {
      BrowserWindow.getFocusedWindow()?.webContents.send(
        'main-menu:copy-snippet'
      )
    }
  },
  {
    label: 'Preview Markdown',
    accelerator: 'Shift+CommandOrControl+M',
    click: () => {
      BrowserWindow.getFocusedWindow()?.webContents.send(
        'main-menu:preview-markdown'
      )
    }
  }
]

const menuItems: MenuItemConstructorOptions[] = [
  {
    label: 'massCode',
    submenu: isMac ? appMenuMac : appMenu
  },
  {
    label: 'File',
    submenu: fileMenu
  },
  {
    label: 'Edit',
    role: 'editMenu'
  },
  {
    label: 'Editor',
    submenu: editorMenu
  },
  {
    label: 'Help',
    submenu: helpMenu
  }
]

export const mainMenu = createMenu(menuItems)
