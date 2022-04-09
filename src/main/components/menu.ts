import type { MenuItemConstructorOptions } from 'electron'
import { Menu, BrowserWindow } from 'electron'

export const createMenu = (template: MenuItemConstructorOptions[]) => {
  const menu = Menu.buildFromTemplate(template)
  return menu
}

export const createPopupMenu = (template: MenuItemConstructorOptions[]) => {
  const menu = createMenu(template)
  menu.popup({ window: BrowserWindow.getFocusedWindow()! })

  return menu
}
