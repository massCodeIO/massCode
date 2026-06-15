/* eslint-disable node/prefer-global/process */
import type {
  MainMenuContentSortField,
  MainMenuContentSortOrder,
  MainMenuContext,
  MainMenuLayoutMode,
  MainMenuPrimaryAction,
} from '../types/menu'
import type { MenuConfig } from './utils'
import os from 'node:os'
import {
  app,
  BrowserWindow,
  dialog,
  Menu,
  type MenuItemConstructorOptions,
  shell,
} from 'electron'
import i18n from '../i18n'
import { send } from '../ipc'
import { checkForUpdatesFromMenu } from '../updates'
import { createMenu, createPlatformMenuItems } from './utils'

const year = new Date().getFullYear()
const version = app.getVersion()

const isDev = process.env.NODE_ENV === 'development'

const defaultMainMenuContext: MainMenuContext = {
  file: {
    primaryAction: null,
    secondaryAction: null,
    canCreateFragment: false,
    canCreateTask: false,
  },
  view: {
    layoutMode: null,
    layoutModes: [],
    contentSortField: null,
    contentSortOrder: null,
    canToggleCompactMode: false,
    canToggleMindmap: false,
    isCompactMode: false,
    isMindmapShown: false,
    canTogglePresentation: false,
    isPresentationShown: false,
  },
  editor: {
    kind: null,
    noteMode: null,
    canSendRequest: false,
    canFormat: false,
    canPreviewCode: false,
    isCodePreviewShown: false,
    canPreviewJson: false,
    isJsonPreviewShown: false,
    canAdjustFontSize: false,
  },
}

let currentMainMenuContext = defaultMainMenuContext

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
    click: () => checkForUpdatesFromMenu(),
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
    type: 'separator' as const,
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
    type: 'separator' as const,
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
    label: i18n.t('menu:app.about'),
    click: () => aboutApp(),
  },
  {
    label: i18n.t('menu:help.website'),
    click: () => {
      shell.openExternal('https://masscode.io')
    },
  },
  {
    label: i18n.t('menu:help.documentation'),
    click: () => {
      shell.openExternal('https://masscode.io/documentation')
    },
  },
  {
    label: i18n.t('menu:help.twitter'),
    click: () => {
      shell.openExternal('https://twitter.com/anton_reshetov')
    },
  },
  {
    type: 'separator',
  },
  {
    label: i18n.t('menu:help.viewInGitHub'),
    click: () => {
      shell.openExternal('https://github.com/massCodeIO/massCode')
    },
  },
  {
    label: i18n.t('menu:help.changeLog'),
    click: () => {
      shell.openExternal('https://github.com/massCodeIO/massCode/releases')
    },
  },
  {
    label: i18n.t('menu:help.reportIssue'),
    click: () => {
      shell.openExternal(
        'https://github.com/massCodeIO/massCode/issues/new/choose',
      )
    },
  },
  {
    label: i18n.t('menu:help.giveStar'),
    click: () => {
      shell.openExternal('https://github.com/massCodeIO/massCode/stargazers')
    },
  },
  {
    type: 'separator',
  },
  {
    label: i18n.t('menu:help.extension.vscode'),
    click: () => {
      shell.openExternal(
        'https://marketplace.visualstudio.com/items?itemName=AntonReshetov.masscode-assistant',
      )
    },
  },
  {
    type: 'separator',
  },
  {
    label: i18n.t('menu:help.links.snippets'),
    click: () => {
      shell.openExternal('https://masscode.io/snippets')
    },
  },
  {
    type: 'separator',
  },
  {
    label: i18n.t('menu:help.donate.openCollective'),
    click: () => {
      shell.openExternal('https://opencollective.com/masscode')
    },
  },
  {
    label: i18n.t('menu:help.donate.gumroad'),
    click: () => {
      shell.openExternal('https://antonreshetov.gumroad.com/l/masscode')
    },
  },
  {
    label: i18n.t('menu:help.donate.payPal'),
    click: () => {
      shell.openExternal('https://www.paypal.com/paypalme/antongithub')
    },
  },
  {
    type: 'separator',
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
  {
    type: 'separator',
  },
  {
    label: i18n.t('menu:edit.find'),
    accelerator: 'CommandOrControl+F',
    click: () => send('main-menu:find'),
  },
]

function getPrimaryActionLabel(action: MainMenuPrimaryAction) {
  if (action === 'new-snippet')
    return i18n.t('action.new.snippet')
  if (action === 'new-note')
    return i18n.t('action.new.note')
  if (action === 'new-sheet')
    return i18n.t('spaces.math.newSheet')
  return ''
}

function createPrimaryActionClick(action: MainMenuPrimaryAction) {
  if (action === 'new-snippet') {
    return () => send('main-menu:new-snippet')
  }

  if (action === 'new-note') {
    return () => send('main-menu:new-note')
  }

  if (action === 'new-sheet') {
    return () => send('main-menu:new-sheet')
  }

  return undefined
}

function createFileMenuItems(context: MainMenuContext): MenuConfig[] {
  const items: MenuConfig[] = []

  if (context.file.primaryAction) {
    items.push({
      label: getPrimaryActionLabel(context.file.primaryAction),
      accelerator: 'CommandOrControl+N',
      click: createPrimaryActionClick(context.file.primaryAction),
    })
  }

  if (context.file.canCreateFragment) {
    items.push({
      label: i18n.t('action.new.fragment'),
      accelerator: 'CommandOrControl+T',
      click: () => send('main-menu:new-fragment'),
    })
  }

  if (context.file.canCreateTask) {
    items.push({
      label: i18n.t('action.new.task'),
      accelerator: 'CommandOrControl+T',
      click: () => send('main-menu:new-task'),
    })
  }

  if (context.file.secondaryAction) {
    items.push({
      label: i18n.t('action.new.folder'),
      accelerator: 'CommandOrControl+Shift+N',
      click: () =>
        send(
          context.file.primaryAction === 'new-note'
            ? 'main-menu:new-note-folder'
            : 'main-menu:new-folder',
        ),
    })
  }

  return items
}

function getSidebarLayoutAccelerator(
  targetLayout: MainMenuLayoutMode,
  currentLayout: MainMenuLayoutMode | null,
) {
  if (currentLayout === 'all-panels' && targetLayout === 'list-editor') {
    return 'Alt+CommandOrControl+B'
  }

  if (currentLayout !== 'all-panels' && targetLayout === 'all-panels') {
    return 'Alt+CommandOrControl+B'
  }

  return undefined
}

function createLayoutMenuItems(context: MainMenuContext): MenuConfig[] {
  if (!context.view.layoutModes.length || !context.view.layoutMode) {
    return []
  }

  const labels: Record<MainMenuLayoutMode, string> = {
    'all-panels': i18n.t('menu:view.layout.allPanels'),
    'list-editor': i18n.t('menu:view.layout.listEditor'),
    'editor-only': i18n.t('menu:view.layout.editorOnly'),
  }

  return context.view.layoutModes.map(layoutMode => ({
    label: labels[layoutMode],
    type: 'radio',
    checked: context.view.layoutMode === layoutMode,
    accelerator: getSidebarLayoutAccelerator(
      layoutMode,
      context.view.layoutMode,
    ),
    click: () => send('main-menu:set-layout-mode', layoutMode),
  }))
}

function createSortMenuItems(context: MainMenuContext): MenuConfig[] {
  if (!context.view.contentSortField || !context.view.contentSortOrder) {
    return []
  }

  const sortLabels: Record<MainMenuContentSortField, string> = {
    updatedAt: i18n.t('menu:view.sortBy.dateModified'),
    createdAt: i18n.t('menu:view.sortBy.dateCreated'),
    name: i18n.t('menu:view.sortBy.name'),
  }
  const orderLabels: Record<MainMenuContentSortOrder, string> = {
    ASC: i18n.t('menu:view.sortOrder.ascending'),
    DESC: i18n.t('menu:view.sortOrder.descending'),
  }

  const sortItems = (Object.keys(sortLabels) as MainMenuContentSortField[]).map(
    sortField => ({
      label: sortLabels[sortField],
      type: 'radio' as const,
      checked: context.view.contentSortField === sortField,
      click: () => send('main-menu:set-content-sort-field', sortField),
    }),
  )
  const orderItems = (
    Object.keys(orderLabels) as MainMenuContentSortOrder[]
  ).map(sortOrder => ({
    label: orderLabels[sortOrder],
    type: 'radio' as const,
    checked: context.view.contentSortOrder === sortOrder,
    click: () => send('main-menu:set-content-sort-order', sortOrder),
  }))

  return [
    {
      label: i18n.t('menu:view.sortBy.label'),
      enabled: false,
    },
    ...sortItems,
    { type: 'separator' as const },
    {
      label: i18n.t('menu:view.sortOrder.label'),
      enabled: false,
    },
    ...orderItems,
  ]
}

function createViewMenuItems(context: MainMenuContext): MenuConfig[] {
  const items = createLayoutMenuItems(context)
  const sortItems = createSortMenuItems(context)

  if (sortItems.length) {
    if (items.length) {
      items.push({ type: 'separator' })
    }

    items.push(...sortItems)
  }

  if (context.view.canToggleCompactMode) {
    if (items.length) {
      items.push({ type: 'separator' })
    }

    items.push({
      label: i18n.t('menu:view.compactMode'),
      type: 'checkbox',
      checked: context.view.isCompactMode,
      click: () => send('main-menu:toggle-compact-mode'),
    })
  }

  if (context.view.canToggleMindmap || context.view.canTogglePresentation) {
    if (items.length) {
      items.push({ type: 'separator' })
    }

    items.push({
      label: i18n.t('menu:markdown.previewMindmap'),
      type: 'checkbox',
      enabled: context.view.canToggleMindmap,
      checked: context.view.isMindmapShown,
      click: () => send('main-menu:preview-mindmap'),
      accelerator: 'CommandOrControl+Shift+I',
    })
    items.push({
      label: i18n.t('menu:markdown.presentationMode'),
      type: 'checkbox',
      enabled: context.view.canTogglePresentation,
      checked: context.view.isPresentationShown,
      click: () => send('main-menu:presentation-mode'),
      accelerator: 'CommandOrControl+Shift+P',
    })
  }

  return items
}

function createHistoryMenuItems(): MenuConfig[] {
  return [
    {
      label: i18n.t('menu:history.back'),
      accelerator: 'CommandOrControl+[',
      click: () => send('main-menu:navigate-back'),
    },
    {
      label: i18n.t('menu:history.forward'),
      accelerator: 'CommandOrControl+]',
      click: () => send('main-menu:navigate-forward'),
    },
  ]
}

function createNotesEditorModeItems(context: MainMenuContext): MenuConfig[] {
  if (context.editor.kind !== 'notes' || !context.editor.noteMode) {
    return []
  }

  return [
    {
      label: i18n.t('menu:editor.mode'),
      submenu: createPlatformMenuItems([
        {
          label: i18n.t('menu:editor.modeRaw'),
          type: 'radio',
          checked: context.editor.noteMode === 'raw',
          click: () => send('main-menu:set-notes-editor-mode', 'raw'),
        },
        {
          label: i18n.t('menu:editor.modeLivePreview'),
          type: 'radio',
          checked: context.editor.noteMode === 'livePreview',
          click: () => send('main-menu:set-notes-editor-mode', 'livePreview'),
        },
        {
          label: i18n.t('menu:editor.modePreview'),
          type: 'radio',
          checked: context.editor.noteMode === 'preview',
          click: () => send('main-menu:set-notes-editor-mode', 'preview'),
        },
      ]),
    },
  ]
}

function createEditorMenuItems(context: MainMenuContext): MenuConfig[] {
  const items: MenuConfig[] = []

  if (context.editor.kind === 'code') {
    items.push({
      label: i18n.t('menu:editor.copySnippet'),
      click: () => send('main-menu:copy-snippet'),
      accelerator: 'CommandOrControl+Shift+C',
    })
    items.push({
      label: i18n.t('menu:editor.format'),
      accelerator: 'Shift+CommandOrControl+F',
      click: () => send('main-menu:format'),
    })
    items.push({
      label: i18n.t('menu:editor.previewCode'),
      type: 'checkbox',
      enabled: context.editor.canPreviewCode,
      checked: context.editor.isCodePreviewShown,
      click: () => send('main-menu:preview-code'),
      accelerator: 'Alt+CommandOrControl+P',
    })
    items.push({
      label: i18n.t('menu:editor.previewJson'),
      type: 'checkbox',
      enabled: context.editor.canPreviewJson,
      checked: context.editor.isJsonPreviewShown,
      click: () => send('main-menu:preview-json'),
      accelerator: 'Alt+CommandOrControl+J',
    })
  }

  if (context.editor.kind === 'notes') {
    items.push({
      label: i18n.t('menu:editor.copyNote'),
      click: () => send('main-menu:copy-note'),
      accelerator: 'CommandOrControl+Shift+C',
    })
  }

  if (context.editor.kind === 'http') {
    items.push({
      label: i18n.t('menu:editor.sendRequest'),
      enabled: context.editor.canSendRequest,
      click: () => send('main-menu:send-http-request'),
      accelerator: 'CommandOrControl+Enter',
    })
  }

  const notesModeItems = createNotesEditorModeItems(context)
  if (notesModeItems.length) {
    if (items.length) {
      items.push({ type: 'separator' })
    }

    items.push(...notesModeItems)
  }

  if (context.editor.canAdjustFontSize) {
    if (items.length) {
      items.push({ type: 'separator' })
    }

    items.push(
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
    )
  }

  return items
}

function createMainMenuTemplate(
  context: MainMenuContext = currentMainMenuContext,
): MenuItemConstructorOptions[] {
  const fileMenuItems = createFileMenuItems(context)
  const historyMenuItems = createHistoryMenuItems()
  const viewMenuItems = createViewMenuItems(context)
  const editorMenuItems = createEditorMenuItems(context)

  const template: MenuItemConstructorOptions[] = [
    {
      label: i18n.t('menu:app.label'),
      submenu: createPlatformMenuItems(appMenuItems),
    },
    {
      role: 'editMenu',
      submenu: createPlatformMenuItems(editMenuItems),
    },
    {
      label: i18n.t('menu:history.label'),
      submenu: createPlatformMenuItems(historyMenuItems),
    },
    {
      role: 'windowMenu',
    },
    {
      label: i18n.t('menu:help.label'),
      submenu: createPlatformMenuItems(helpMenuItems),
    },
  ]

  if (fileMenuItems.length) {
    template.splice(1, 0, {
      label: i18n.t('menu:file.label'),
      submenu: createPlatformMenuItems(fileMenuItems),
    })
  }

  const viewInsertIndex = template.findIndex(
    item => item.role === 'windowMenu',
  )

  if (viewMenuItems.length) {
    template.splice(viewInsertIndex, 0, {
      label: i18n.t('menu:view.label'),
      submenu: createPlatformMenuItems(viewMenuItems),
    })
  }

  if (editorMenuItems.length) {
    const insertIndex = template.findIndex(
      item => item.role === 'windowMenu',
    )
    template.splice(insertIndex, 0, {
      label: i18n.t('menu:editor.label'),
      submenu: createPlatformMenuItems(editorMenuItems),
    })
  }

  return template
}

export function createMainMenu(
  context: MainMenuContext = currentMainMenuContext,
) {
  return createMenu(createMainMenuTemplate(context))
}

export function updateMainMenu(context: MainMenuContext) {
  currentMainMenuContext = context
  Menu.setApplicationMenu(createMainMenu(context))
}
