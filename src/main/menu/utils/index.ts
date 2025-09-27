/* eslint-disable node/prefer-global/process */
import type { MenuItemConstructorOptions } from 'electron'
import { Menu } from 'electron'

export type Platform = 'darwin' | 'win32'

export interface MenuConfig extends MenuItemConstructorOptions {
  platforms?: Platform[]
}

export function createPlatformMenuItems(
  items: MenuConfig[],
  currentPlatform: Platform = process.platform as Platform,
): MenuItemConstructorOptions[] {
  return items
    .filter(
      item => !item.platforms || item.platforms.includes(currentPlatform),
    )
    .map((item) => {
      const { id, platforms, ...menuItem } = item
      return menuItem as MenuItemConstructorOptions
    })
}

export function createMenu(template: MenuItemConstructorOptions[]) {
  const menu = Menu.buildFromTemplate(template)
  return menu
}
