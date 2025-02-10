import { createMenu } from '../components/menu'
import type { MenuItemConstructorOptions } from 'electron'
import { shell, dialog, BrowserWindow } from 'electron'
import { version } from '../../../package.json'
import os from 'os'
import { checkForUpdate } from '../services/update-check'
import { store } from '../store'
import i18n from '../services/i18n'

const isDev = process.env.NODE_ENV === 'development'
const isMac = process.platform === 'darwin'
const year = new Date().getFullYear()

const aboutApp = () => {
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

const appMenuCommon: Record<
'preferences' | 'quit' | 'update' | 'devtools',
MenuItemConstructorOptions
> = {
  preferences: {
    label: i18n.t('menu:app.preferences'),
    accelerator: 'CommandOrControl+,',
    click: () => {
      BrowserWindow.getFocusedWindow()?.webContents.send(
        'main-menu:preferences'
      )
    }
  },
  devtools: {
    label: i18n.t('menu:devtools.label') + '...',
    accelerator: 'CommandOrControl+.',
    click: () => {
      BrowserWindow.getFocusedWindow()?.webContents.send('main-menu:devtools')
    }
  },
  update: {
    label: i18n.t('menu:app.update.label'),
    click: async () => {
      const newVersion = await checkForUpdate()

      if (newVersion) {
        const buttonId = dialog.showMessageBoxSync(
          BrowserWindow.getFocusedWindow()!,
          {
            message: i18n.t('menu:app.update.message', {
              newVersion,
              oldVersion: version
            }),
            buttons: [
              i18n.t('menu:app.update.button.0'),
              i18n.t('menu:app.update.button.1')
            ],
            defaultId: 0,
            cancelId: 1
          }
        )

        if (buttonId === 0) {
          shell.openExternal('https://masscode.io/download/latest-release.html')
        }
      } else {
        dialog.showMessageBoxSync(BrowserWindow.getFocusedWindow()!, {
          message: i18n.t('menu:app.update.noUpdate')
        })
      }
    }
  },
  quit: {
    label: i18n.t('menu:app.quit'),
    role: 'quit'
  }
}

const appMenuMac: MenuItemConstructorOptions[] = [
  {
    label: i18n.t('menu:app.about'),
    click: () => aboutApp()
  },
  {
    ...appMenuCommon.update
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
    ...appMenuCommon.devtools
  },
  {
    type: 'separator'
  },
  {
    label: i18n.t('menu:app.hide'),
    role: 'hide'
  },
  {
    label: i18n.t('menu:app.hideOther'),
    role: 'hideOthers'
  },
  {
    label: i18n.t('menu:app.showAll'),
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
  { ...appMenuCommon.update },
  { type: 'separator' },
  { ...appMenuCommon.preferences },
  { ...appMenuCommon.devtools },
  { type: 'separator' },
  { ...appMenuCommon.quit }
]

const helpMenu: MenuItemConstructorOptions[] = [
  {
    label: i18n.t('menu:app.about'),
    click: () => aboutApp()
  },
  {
    label: i18n.t('menu:help.website'),
    click: () => {
      shell.openExternal('https://masscode.io')
    }
  },
  {
    label: i18n.t('menu:help.documentation'),
    click: () => {
      shell.openExternal('https://masscode.io/documentation')
    }
  },
  {
    label: i18n.t('menu:help.twitter'),
    click: () => {
      shell.openExternal('https://twitter.com/anton_reshetov')
    }
  },
  {
    type: 'separator'
  },
  {
    label: i18n.t('menu:help.viewInGitHub'),
    click: () => {
      shell.openExternal('https://github.com/massCodeIO/massCode')
    }
  },
  {
    label: i18n.t('menu:help.changeLog'),
    click: () => {
      shell.openExternal(
        'https://github.com/massCodeIO/massCode/blob/master/CHANGELOG.md'
      )
    }
  },
  {
    label: i18n.t('menu:help.reportIssue'),
    click: () => {
      shell.openExternal(
        'https://github.com/massCodeIO/massCode/issues/new/choose'
      )
    }
  },
  {
    label: i18n.t('menu:help.giveStar'),
    click: () => {
      shell.openExternal('https://github.com/massCodeIO/massCode/stargazers')
    }
  },
  {
    type: 'separator'
  },
  {
    label: i18n.t('menu:help.extension.vscode'),
    click: () => {
      shell.openExternal(
        'https://marketplace.visualstudio.com/items?itemName=AntonReshetov.masscode-assistant'
      )
    }
  },
  {
    label: i18n.t('menu:help.extension.raycast'),
    click: () => {
      shell.openExternal('https://www.raycast.com/antonreshetov/masscode')
    }
  },
  {
    label: i18n.t('menu:help.extension.alfred'),
    click: () => {
      shell.openExternal('https://github.com/massCodeIO/assistant-alfred')
    }
  },
  {
    type: 'separator'
  },
  {
    label: i18n.t('menu:help.links.snippets'),
    click: () => {
      shell.openExternal('https://masscode.io/snippets')
    }
  },
  {
    type: 'separator'
  },
  {
    label: i18n.t('menu:help.donate.openCollective'),
    click: () => {
      shell.openExternal('https://opencollective.com/masscode')
    }
  },
  {
    label: i18n.t('menu:help.donate.gumroad'),
    click: () => {
      shell.openExternal('https://antonreshetov.gumroad.com/l/masscode')
    }
  },
  {
    label: i18n.t('menu:help.donate.payPal'),
    click: () => {
      shell.openExternal('https://www.paypal.com/paypalme/antongithub')
    }
  },
  {
    type: 'separator'
  },
  {
    label: i18n.t('menu:help.devTools'),
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
    label: i18n.t('newSnippet'),
    accelerator: 'CommandOrControl+N',
    click: () => {
      BrowserWindow.getFocusedWindow()?.webContents.send(
        'main-menu:new-snippet'
      )
    }
  },
  {
    label: i18n.t('newFragment'),
    accelerator: 'CommandOrControl+T',
    click: () => {
      BrowserWindow.getFocusedWindow()?.webContents.send(
        'main-menu:new-fragment'
      )
    }
  },
  {
    label: i18n.t('addDescription'),
    accelerator: 'CommandOrControl+Shift+T',
    click: () => {
      BrowserWindow.getFocusedWindow()?.webContents.send(
        'main-menu:add-description'
      )
    }
  },
  {
    type: 'separator'
  },
  {
    label: i18n.t('newFolder'),
    accelerator: 'CommandOrControl+Shift+N',
    click: () => {
      BrowserWindow.getFocusedWindow()?.webContents.send('main-menu:new-folder')
    }
  },
  {
    type: 'separator'
  },
  {
    label: i18n.t('menu:file.find'),
    accelerator: 'CommandOrControl+F',
    click: () => {
      BrowserWindow.getFocusedWindow()?.webContents.send('main-menu:search')
    }
  }
]

const viewMenu: MenuItemConstructorOptions[] = [
  {
    label: i18n.t('menu:view.sortBy.label'),
    submenu: [
      {
        label: i18n.t('menu:view.sortBy.dateModified'),
        type: 'radio',
        checked: store.app.get('sort') === 'updatedAt',
        click: () => {
          BrowserWindow.getFocusedWindow()?.webContents.send(
            'main-menu:sort-snippets',
            'updatedAt'
          )
        }
      },
      {
        label: i18n.t('menu:view.sortBy.dateCreated'),
        type: 'radio',
        checked: store.app.get('sort') === 'createdAt',
        click: () => {
          BrowserWindow.getFocusedWindow()?.webContents.send(
            'main-menu:sort-snippets',
            'createdAt'
          )
        }
      },
      {
        label: i18n.t('menu:view.sortBy.name'),
        type: 'radio',
        checked: store.app.get('sort') === 'name',
        click: () => {
          BrowserWindow.getFocusedWindow()?.webContents.send(
            'main-menu:sort-snippets',
            'name'
          )
        }
      }
    ]
  },
  {
    label: i18n.t('menu:view.hideSubfolderSnippets'),
    type: 'checkbox',
    checked: store.app.get('hideSubfolderSnippets'),
    click: () => {
      BrowserWindow.getFocusedWindow()?.webContents.send(
        'main-menu:hide-subfolder-snippets'
      )
    }
  },
  {
    label: i18n.t('menu:view.compactMode'),
    type: 'checkbox',
    checked: store.app.get('compactMode'),
    click: () => {
      BrowserWindow.getFocusedWindow()?.webContents.send(
        'main-menu:compact-mode-snippets'
      )
    }
  }
]

const editorMenu: MenuItemConstructorOptions[] = [
  {
    label: i18n.t('menu:editor.copy'),
    accelerator: 'Shift+CommandOrControl+C',
    click: () => {
      BrowserWindow.getFocusedWindow()?.webContents.send(
        'main-menu:copy-snippet'
      )
    }
  },
  {
    label: i18n.t('menu:editor.format'),
    accelerator: 'Shift+CommandOrControl+F',
    click: () => {
      BrowserWindow.getFocusedWindow()?.webContents.send(
        'main-menu:format-snippet'
      )
    }
  },
  {
    label: i18n.t('menu:editor.previewCode'),
    accelerator: 'Shift+CommandOrControl+P',
    click: () => {
      BrowserWindow.getFocusedWindow()?.webContents.send(
        'main-menu:preview-code'
      )
    }
  },
  {
    type: 'separator'
  },
  {
    label: i18n.t('menu:editor.fontSizeIncrease'),
    accelerator: 'CommandOrControl+=',
    click: () => {
      BrowserWindow.getFocusedWindow()?.webContents.send(
        'main-menu:font-size-increase'
      )
    }
  },
  {
    label: i18n.t('menu:editor.fontSizeDecrease'),
    accelerator: 'CommandOrControl+-',
    click: () => {
      BrowserWindow.getFocusedWindow()?.webContents.send(
        'main-menu:font-size-decrease'
      )
    }
  },
  {
    label: i18n.t('menu:editor.fontSizeReset'),
    accelerator: 'CommandOrControl+0',
    click: () => {
      BrowserWindow.getFocusedWindow()?.webContents.send(
        'main-menu:font-size-reset'
      )
    }
  }
]

const markdownMenu: MenuItemConstructorOptions[] = [
  {
    label: i18n.t('menu:markdown.preview'),
    accelerator: 'Shift+CommandOrControl+M',
    click: () => {
      BrowserWindow.getFocusedWindow()?.webContents.send(
        'main-menu:preview-markdown'
      )
    }
  },
  {
    label: i18n.t('menu:editor.previewMindmap'),
    accelerator: 'Shift+CommandOrControl+I',
    click: () => {
      BrowserWindow.getFocusedWindow()?.webContents.send(
        'main-menu:preview-mindmap'
      )
    }
  },
  {
    type: 'separator'
  },
  {
    label: i18n.t('menu:markdown.presentationMode'),
    accelerator: 'Alt+CommandOrControl+P',
    click: () => {
      BrowserWindow.getFocusedWindow()?.webContents.send(
        'main-menu:presentation-mode'
      )
    }
  }
]

const editMenu: MenuItemConstructorOptions[] = [
  {
    label: i18n.t('menu:edit.undo'),
    role: 'undo'
  },
  {
    label: i18n.t('menu:edit.redo'),
    role: 'redo'
  },
  { type: 'separator' },
  {
    label: i18n.t('menu:edit.cut'),
    role: 'cut'
  },
  {
    label: i18n.t('menu:edit.copy'),
    role: 'copy'
  },
  {
    label: i18n.t('menu:edit.paste'),
    role: 'paste'
  },
  {
    label: i18n.t('menu:edit.delete'),
    role: 'delete'
  },
  { type: 'separator' },
  {
    label: i18n.t('menu:edit.selectAll'),
    role: 'selectAll'
  }
]

const historyMenu: MenuItemConstructorOptions[] = [
  {
    label: i18n.t('menu:history.back'),
    accelerator: 'CommandOrControl+[',
    click: () => {
      BrowserWindow.getFocusedWindow()?.webContents.send(
        'main-menu:history-back'
      )
    }
  },
  {
    label: i18n.t('menu:history.forward'),
    accelerator: 'CommandOrControl+]',
    click: () => {
      BrowserWindow.getFocusedWindow()?.webContents.send(
        'main-menu:history-forward'
      )
    }
  }
]

const windowMenu: MenuItemConstructorOptions[] = [
  {
    label: i18n.t('menu:window.minimize'),
    accelerator: 'CommandOrControl+M',
    role: 'minimize'
  }
]

const menuItems: MenuItemConstructorOptions[] = [
  {
    label: i18n.t('menu:app.label'),
    submenu: isMac ? appMenuMac : appMenu
  },
  {
    label: i18n.t('menu:file.label'),
    submenu: fileMenu
  },
  {
    label: i18n.t('menu:view.label'),
    submenu: viewMenu
  },
  {
    label: i18n.t('menu:edit.label'),
    submenu: editMenu
  },
  {
    label: i18n.t('menu:editor.label'),
    submenu: editorMenu
  },
  {
    label: i18n.t('menu:markdown.label'),
    submenu: markdownMenu
  },
  {
    label: i18n.t('menu:history.label'),
    submenu: historyMenu
  },
  {
    label: i18n.t('menu:window.label'),
    submenu: windowMenu
  },
  {
    label: i18n.t('menu:help.label'),
    submenu: helpMenu
  }
]

export const mainMenu = createMenu(menuItems)
