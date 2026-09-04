import type { MenuItemConstructorOptions } from 'electron'
import process from 'node:process'
import { createInstance } from 'i18next'
import { afterEach, describe, expect, it, vi } from 'vitest'
import english from '../../i18n/locales/en_US/menu.json'
import russian from '../../i18n/locales/ru_RU/menu.json'

vi.mock('electron', () => ({
  app: { getVersion: () => '1.0.0' },
  BrowserWindow: { getFocusedWindow: () => null },
  dialog: {},
  Menu: { buildFromTemplate: (template: unknown) => template },
  shell: {},
}))

vi.mock('../../i18n', async () => {
  const i18n = createInstance()
  await i18n.init({
    lng: 'en_US',
    fallbackLng: 'en_US',
    resources: {
      en_US: { menu: english },
      ru_RU: { menu: russian },
    },
  })
  return { default: i18n }
})

vi.mock('../../ipc', () => ({ send: vi.fn() }))
vi.mock('../../updates', () => ({ checkForUpdatesFromMenu: vi.fn() }))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe.each(['win32', 'darwin', 'linux'])('main menu localization on %s', (platform) => {
  it.each(['ru_RU', 'en_US', 'missing_locale'])('uses %s labels and keeps native roles', async (locale) => {
    vi.resetModules()
    vi.stubGlobal('process', { ...process, platform })
    const { default: i18n } = await import('../../i18n')
    await i18n.changeLanguage(locale)
    const { createMainMenu } = await import('../main')
    const template = createMainMenu() as unknown as MenuItemConstructorOptions[]
    const edit = template.find(item => item.role === 'editMenu')!
    const window = template.find(item => item.role === 'windowMenu')!
    const editItems = edit.submenu as MenuItemConstructorOptions[]
    const windowItems = window.submenu as MenuItemConstructorOptions[]
    const isRussian = locale === 'ru_RU'

    expect(edit.label).toBe(isRussian ? 'Правка' : 'Edit')
    expect(window.label).toBe(isRussian ? 'Окно' : 'Window')
    expect(editItems.filter(item => item.role).map(item => [item.role, item.label]))
      .toEqual([
        ['undo', isRussian ? 'Отменить' : 'Undo'],
        ['redo', isRussian ? 'Повторить' : 'Redo'],
        ['cut', isRussian ? 'Вырезать' : 'Cut'],
        ['copy', isRussian ? 'Копировать' : 'Copy'],
        ['paste', isRussian ? 'Вставить' : 'Paste'],
        ['delete', isRussian ? 'Удалить' : 'Delete'],
        ['selectAll', isRussian ? 'Выделить всё' : 'Select All'],
      ])
    expect(editItems.at(-1)).toMatchObject({
      label: isRussian ? 'Найти' : 'Find',
      accelerator: 'CommandOrControl+F',
      click: expect.any(Function),
    })
    expect(windowItems.map(item => item.role ?? item.type)).toEqual(
      platform === 'darwin'
        ? ['minimize', 'zoom', 'separator', 'front']
        : ['minimize', 'zoom', 'close'],
    )
    expect(windowItems.filter(item => item.role).map(item => item.label)).toEqual([
      isRussian ? 'Свернуть' : 'Minimize',
      isRussian ? 'Изменить размер окна' : 'Zoom',
      platform === 'darwin'
        ? (isRussian ? 'Все окна на передний план' : 'Bring All to Front')
        : (isRussian ? 'Закрыть' : 'Close'),
    ])
    // Electron supplies the actions and platform-specific shortcuts for roles.
    for (const item of [...editItems, ...windowItems].filter(item => item.role)) {
      expect(item.click).toBeUndefined()
      expect(item.accelerator).toBeUndefined()
    }
  })
})
