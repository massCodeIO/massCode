import type { MenuItemConstructorOptions } from 'electron'
import { Menu, BrowserWindow } from 'electron'

export const createMenu = (template: MenuItemConstructorOptions[]) => {
  const menu = Menu.buildFromTemplate(template)
  return menu
}
