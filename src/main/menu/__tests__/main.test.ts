import type { MainMenuContext } from '../../types/menu'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const buildFromTemplate = vi.fn((template: unknown) => template)

vi.mock('electron', () => ({
  app: {
    getVersion: () => '1.0.0',
  },
  BrowserWindow: {
    getFocusedWindow: () => null,
  },
  dialog: {
    showMessageBox: vi.fn(),
    showMessageBoxSync: vi.fn(),
  },
  Menu: {
    buildFromTemplate,
    setApplicationMenu: vi.fn(),
  },
  shell: {
    openExternal: vi.fn(),
  },
}))

vi.mock('../../i18n', () => ({
  default: {
    t: (key: string) => key,
  },
}))

vi.mock('../../ipc', () => ({
  send: vi.fn(),
}))

vi.mock('../../updates', () => ({
  fetchUpdates: vi.fn(),
}))

vi.mock('../../../../package.json', () => ({
  repository: 'https://example.com/repo',
}))

describe('createMainMenu', () => {
  beforeEach(() => {
    buildFromTemplate.mockClear()
  })

  it('renders file and view actions on the first submenu level', async () => {
    const { createMainMenu } = await import('../main')

    const context: MainMenuContext = {
      file: {
        primaryAction: 'new-snippet',
        secondaryAction: 'new-folder',
        canCreateFragment: true,
      },
      view: {
        layoutMode: 'all-panels',
        layoutModes: ['all-panels', 'list-editor', 'editor-only'],
        canToggleCompactMode: true,
        canToggleMindmap: false,
        isCompactMode: true,
        isMindmapShown: false,
        canTogglePresentation: false,
        isPresentationShown: false,
      },
      editor: {
        kind: 'code',
        noteMode: null,
        canSendRequest: false,
        canFormat: true,
        canPreviewCode: true,
        isCodePreviewShown: false,
        canPreviewJson: false,
        isJsonPreviewShown: false,
        canAdjustFontSize: true,
      },
    }

    createMainMenu(context)

    const template = buildFromTemplate.mock.calls[0]?.[0] as Array<{
      label?: string
      submenu?: Array<{ label?: string, submenu?: unknown[] }>
    }>

    const fileMenu = template.find(item => item.label === 'menu:file.label')
    const viewMenu = template.find(item => item.label === 'menu:view.label')

    expect(fileMenu?.submenu?.map(item => item.label)).toEqual([
      'action.new.snippet',
      'action.new.fragment',
      'action.new.folder',
    ])
    expect(fileMenu?.submenu?.some(item => Array.isArray(item.submenu))).toBe(
      false,
    )

    expect(viewMenu?.submenu?.map(item => item.label)).toEqual([
      'menu:view.layout.allPanels',
      'menu:view.layout.listEditor',
      'menu:view.layout.editorOnly',
      undefined,
      'menu:view.compactMode',
    ])
    expect(viewMenu?.submenu?.some(item => Array.isArray(item.submenu))).toBe(
      false,
    )
  })

  it('omits compact mode when the current space has no list', async () => {
    const { createMainMenu } = await import('../main')

    const context: MainMenuContext = {
      file: {
        primaryAction: null,
        secondaryAction: null,
        canCreateFragment: false,
      },
      view: {
        layoutMode: null,
        layoutModes: [],
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

    createMainMenu(context)

    const template = buildFromTemplate.mock.calls[0]?.[0] as Array<{
      label?: string
      submenu?: Array<{ label?: string, type?: string, checked?: boolean }>
    }>
    const viewMenu = template.find(item => item.label === 'menu:view.label')
    const compactModeItem = viewMenu?.submenu?.find(
      item => item.label === 'menu:view.compactMode',
    )

    expect(compactModeItem).toBeUndefined()
  })

  it('marks compact mode as checked when enabled', async () => {
    const { createMainMenu } = await import('../main')

    const context: MainMenuContext = {
      file: {
        primaryAction: 'new-sheet',
        secondaryAction: null,
        canCreateFragment: false,
      },
      view: {
        layoutMode: null,
        layoutModes: [],
        canToggleCompactMode: true,
        canToggleMindmap: false,
        isCompactMode: true,
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

    createMainMenu(context)

    const template = buildFromTemplate.mock.calls[0]?.[0] as Array<{
      label?: string
      submenu?: Array<{ label?: string, type?: string, checked?: boolean }>
    }>
    const viewMenu = template.find(item => item.label === 'menu:view.label')
    const compactModeItem = viewMenu?.submenu?.find(
      item => item.label === 'menu:view.compactMode',
    )

    expect(compactModeItem).toMatchObject({
      checked: true,
      type: 'checkbox',
    })
  })

  it('does not include space navigation items in the app menu', async () => {
    const { createMainMenu } = await import('../main')

    createMainMenu()

    const template = buildFromTemplate.mock.calls[0]?.[0] as Array<{
      label?: string
      submenu?: Array<{ label?: string }>
    }>

    const appMenu = template.find(item => item.label === 'menu:app.label')
    const labels = appMenu?.submenu?.map(item => item.label) ?? []

    expect(labels).not.toContain('menu:app.devtools')
    expect(labels).not.toContain('menu:app.mathNotebook')
  })

  it('renders send request in the editor menu for http space', async () => {
    const { createMainMenu } = await import('../main')

    const context: MainMenuContext = {
      file: {
        primaryAction: null,
        secondaryAction: null,
        canCreateFragment: false,
      },
      view: {
        layoutMode: 'all-panels',
        layoutModes: ['all-panels', 'list-editor', 'editor-only'],
        canToggleCompactMode: false,
        canToggleMindmap: false,
        isCompactMode: false,
        isMindmapShown: false,
        canTogglePresentation: false,
        isPresentationShown: false,
      },
      editor: {
        kind: 'http',
        noteMode: null,
        canSendRequest: true,
        canFormat: false,
        canPreviewCode: false,
        isCodePreviewShown: false,
        canPreviewJson: false,
        isJsonPreviewShown: false,
        canAdjustFontSize: false,
      },
    }

    createMainMenu(context)

    const template = buildFromTemplate.mock.calls[0]?.[0] as Array<{
      label?: string
      submenu?: Array<{
        label?: string
        accelerator?: string
        enabled?: boolean
      }>
    }>
    const fileMenu = template.find(item => item.label === 'menu:file.label')
    const editorMenu = template.find(
      item => item.label === 'menu:editor.label',
    )
    const sendRequestItem = editorMenu?.submenu?.find(
      item => item.label === 'menu:editor.sendRequest',
    )

    expect(fileMenu).toBeUndefined()
    expect(sendRequestItem).toMatchObject({
      accelerator: 'CommandOrControl+Enter',
      enabled: true,
    })
  })
})
