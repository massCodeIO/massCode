import type { MenuItemConstructorOptions } from 'electron'
import { Menu, BrowserWindow } from 'electron'

export const createPopupMenu = (template: MenuItemConstructorOptions[]) => {
  const menu = Menu.buildFromTemplate(template)
  menu.popup({ window: BrowserWindow.getFocusedWindow()! })
}
