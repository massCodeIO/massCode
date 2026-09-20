import type { MainMenuContext } from '../../types/menu'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const buildFromTemplate = vi.fn((template: unknown) => template)
const send = vi.fn()

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
  send,
}))

vi.mock('../../updates', () => ({
  fetchUpdates: vi.fn(),
}))

vi.mock('../../../../package.json', () => ({
  repository: 'https://example.com/repo',
}))

function createNotesContext(
  options: {
    canToggleMindmap?: boolean
    isMindmapShown?: boolean
    isPresentationShown?: boolean
    noteMode?: MainMenuContext['editor']['noteMode']
  } = {},
): MainMenuContext {
  return {
    file: {
      primaryAction: 'new-note',
      secondaryAction: 'new-folder',
      canCreateFragment: false,
      canCreateTask: true,
    },
    view: {
      layoutMode: 'all-panels',
      layoutModes: ['all-panels', 'list-editor', 'editor-only'],
      contentSortField: 'updatedAt',
      contentSortOrder: 'DESC',
      canToggleCompactMode: true,
      canToggleHideCompletedTasks: false,
      isHideCompletedTasksInFolders: false,
      canToggleMindmap: options.canToggleMindmap ?? true,
      isCompactMode: false,
      isMindmapShown: options.isMindmapShown ?? false,
      canTogglePresentation: true,
      isPresentationShown: options.isPresentationShown ?? false,
    },
    editor: {
      kind: 'notes',
      noteMode: options.noteMode ?? 'livePreview',
      canSendRequest: false,
      canFormat: false,
      canPreviewCode: false,
      isCodePreviewShown: false,
      canPreviewJson: false,
      isJsonPreviewShown: false,
      canAdjustFontSize: true,
    },
  }
}

describe('createMainMenu', () => {
  beforeEach(() => {
    buildFromTemplate.mockClear()
    send.mockClear()
  })

  it('renders file and view actions on the first submenu level', async () => {
    const { createMainMenu } = await import('../main')

    const context: MainMenuContext = {
      file: {
        primaryAction: 'new-snippet',
        secondaryAction: 'new-folder',
        canCreateFragment: true,
        canCreateTask: false,
      },
      view: {
        layoutMode: 'all-panels',
        layoutModes: ['all-panels', 'list-editor', 'editor-only'],
        contentSortField: 'updatedAt',
        contentSortOrder: 'DESC',
        canToggleCompactMode: true,
        canToggleHideCompletedTasks: false,
        isHideCompletedTasksInFolders: false,
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
      role?: string
      submenu?: Array<{
        label?: string
        accelerator?: string
        submenu?: unknown[]
        click?: () => void
      }>
    }>

    const fileMenu = template.find(item => item.label === 'menu:file.label')
    const editMenu = template.find(item => item.role === 'editMenu')
    const viewMenu = template.find(item => item.label === 'menu:view.label')
    const editorMenu = template.find(
      item => item.label === 'menu:editor.label',
    )

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
      'ui:ai.title',
      undefined,
      'menu:view.sortBy.label',
      'menu:view.sortBy.dateModified',
      'menu:view.sortBy.dateCreated',
      'menu:view.sortBy.name',
      undefined,
      'menu:view.sortOrder.label',
      'menu:view.sortOrder.ascending',
      'menu:view.sortOrder.descending',
      undefined,
      'menu:view.compactMode',
    ])
    expect(viewMenu?.submenu?.some(item => Array.isArray(item.submenu))).toBe(
      false,
    )

    const editorLabels = editorMenu?.submenu?.map(item => item.label) ?? []
    const formatIndex = editorLabels.indexOf('menu:editor.format')
    const formatItem = editorMenu?.submenu?.[formatIndex]
    const findItem = editMenu?.submenu?.find(
      item => item.label === 'menu:edit.find',
    )

    expect(findItem).toMatchObject({ accelerator: 'CommandOrControl+F' })
    findItem?.click?.()
    expect(send).toHaveBeenCalledWith('main-menu:find')
    expect(formatItem).toMatchObject({ accelerator: 'Shift+Alt+F' })

    expect(editorLabels[formatIndex + 1]).toBe(
      'menu:editor.normalizeTerminalOutput',
    )

    editorMenu?.submenu
      ?.find(item => item.label === 'menu:editor.normalizeTerminalOutput')
      ?.click?.()

    expect(send).toHaveBeenCalledWith('main-menu:normalize-code-line-breaks')
    expect(
      editorMenu?.submenu?.find(
        item => item.label === 'menu:editor.normalizeTerminalOutput',
      ),
    ).toMatchObject({ enabled: true })
  })

  it('enables line break normalization for an editable selected note', async () => {
    const { createMainMenu } = await import('../main')

    createMainMenu(createNotesContext())

    const template = buildFromTemplate.mock.calls[0]?.[0] as Array<{
      label?: string
      submenu?: Array<{
        label?: string
        enabled?: boolean
        click?: () => void
      }>
    }>
    const editorMenu = template.find(
      item => item.label === 'menu:editor.label',
    )

    const normalizeItem = editorMenu?.submenu?.find(
      item => item.label === 'menu:editor.normalizeTerminalOutput',
    )

    expect(normalizeItem).toMatchObject({ enabled: true })
    normalizeItem?.click?.()
    expect(send).toHaveBeenCalledWith('main-menu:normalize-note-line-breaks')
  })

  it.each([
    ['preview mode', { noteMode: 'preview' as const }],
    ['no selected note', { canToggleMindmap: false }],
    ['mindmap mode', { isMindmapShown: true }],
    ['presentation mode', { isPresentationShown: true }],
  ])('disables line break normalization in %s', async (_label, options) => {
    const { createMainMenu } = await import('../main')

    createMainMenu(createNotesContext(options))

    const template = buildFromTemplate.mock.calls[0]?.[0] as Array<{
      label?: string
      submenu?: Array<{ label?: string, enabled?: boolean }>
    }>
    const editorMenu = template.find(
      item => item.label === 'menu:editor.label',
    )

    expect(
      editorMenu?.submenu?.find(
        item => item.label === 'menu:editor.normalizeTerminalOutput',
      ),
    ).toMatchObject({ enabled: false })
  })

  it('omits compact mode when the current space has no list', async () => {
    const { createMainMenu } = await import('../main')

    const context: MainMenuContext = {
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
        canToggleHideCompletedTasks: false,
        isHideCompletedTasksInFolders: false,
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

  it('adds a notes task creation shortcut in notes space', async () => {
    const { createMainMenu } = await import('../main')

    const context: MainMenuContext = {
      file: {
        primaryAction: 'new-note',
        secondaryAction: 'new-folder',
        canCreateFragment: false,
        canCreateTask: true,
      },
      view: {
        layoutMode: 'all-panels',
        layoutModes: ['all-panels', 'list-editor', 'editor-only'],
        contentSortField: 'createdAt',
        contentSortOrder: 'DESC',
        canToggleCompactMode: true,
        canToggleHideCompletedTasks: false,
        isHideCompletedTasksInFolders: false,
        canToggleMindmap: false,
        isCompactMode: false,
        isMindmapShown: false,
        canTogglePresentation: false,
        isPresentationShown: false,
      },
      editor: {
        kind: 'notes',
        noteMode: 'livePreview',
        canSendRequest: false,
        canFormat: false,
        canPreviewCode: false,
        isCodePreviewShown: false,
        canPreviewJson: false,
        isJsonPreviewShown: false,
        canAdjustFontSize: true,
      },
    }

    createMainMenu(context)

    const template = buildFromTemplate.mock.calls[0]?.[0] as Array<{
      label?: string
      submenu?: Array<{ label?: string, accelerator?: string }>
    }>
    const fileMenu = template.find(item => item.label === 'menu:file.label')

    expect(fileMenu?.submenu?.map(item => item.label)).toEqual([
      'action.new.note',
      'action.new.task',
      'action.new.folder',
    ])
    expect(
      fileMenu?.submenu?.find(item => item.label === 'action.new.task'),
    ).toMatchObject({
      accelerator: 'CommandOrControl+T',
    })
  })

  it('marks compact mode as checked when enabled', async () => {
    const { createMainMenu } = await import('../main')

    const context: MainMenuContext = {
      file: {
        primaryAction: 'new-sheet',
        secondaryAction: null,
        canCreateFragment: false,
        canCreateTask: false,
      },
      view: {
        layoutMode: null,
        layoutModes: [],
        contentSortField: null,
        contentSortOrder: null,
        canToggleCompactMode: true,
        canToggleHideCompletedTasks: false,
        isHideCompletedTasksInFolders: false,
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
        canCreateTask: false,
      },
      view: {
        layoutMode: 'all-panels',
        layoutModes: ['all-panels', 'list-editor', 'editor-only'],
        contentSortField: 'createdAt',
        contentSortOrder: 'ASC',
        canToggleCompactMode: false,
        canToggleHideCompletedTasks: false,
        isHideCompletedTasksInFolders: false,
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

it('renders independent HTTP panel checkboxes and dispatches their actions', async () => {
  const { createMainMenu } = await import('../main')
  const context = createNotesContext()
  context.view.layoutMode = null
  context.view.layoutModes = []
  context.view.httpPanels = {
    sidebar: false,
    bottom: true,
    inspector: true,
    canToggleBottom: false,
  }
  buildFromTemplate.mockClear()
  createMainMenu(context)
  const template = buildFromTemplate.mock.calls[0]![0] as Array<{
    label?: string
    submenu?: Array<{
      type?: string
      checked?: boolean
      enabled?: boolean
      click?: () => void
    }>
  }>
  const items = template
    .find(item => item.label === 'menu:view.label')!
    .submenu!.slice(0, 3)
  expect(items.map(item => item.type)).toEqual([
    'checkbox',
    'checkbox',
    'checkbox',
  ])
  expect(items.map(item => item.checked)).toEqual([false, true, true])
  expect(items[1]!.enabled).toBe(false)
  items[0]!.click!()
  expect(send).toHaveBeenLastCalledWith(
    'main-menu:toggle-http-panel',
    'sidebar',
  )
  items[2]!.click!()
  expect(send).toHaveBeenLastCalledWith(
    'main-menu:toggle-http-panel',
    'inspector',
  )
})

it('renders and dispatches the Notes inspector checkbox', async () => {
  const { createMainMenu } = await import('../main')
  const context = createNotesContext()
  context.view.notesInspector = { open: true, enabled: true }
  buildFromTemplate.mockClear()
  createMainMenu(context)
  const template = buildFromTemplate.mock.calls[0]![0] as Array<{
    label?: string
    submenu?: Array<{
      label?: string
      type?: string
      checked?: boolean
      enabled?: boolean
      click?: () => void
    }>
  }>
  const item = template
    .find(item => item.label === 'menu:view.label')!
    .submenu!.find(item => item.label === 'ui:notes.inspector.title')!
  expect(item).toMatchObject({
    type: 'checkbox',
    checked: true,
    enabled: true,
  })
  item.click!()
  expect(send).toHaveBeenLastCalledWith('main-menu:toggle-notes-inspector')
})

it.each(['code', 'notes', 'http', null] as const)(
  'exposes the AI accelerator for %s',
  async (kind) => {
    const { createMainMenu } = await import('../main')
    const context = createNotesContext()
    context.editor.kind = kind
    createMainMenu(context)
    const template = buildFromTemplate.mock.calls.at(-1)![0] as Array<{
      label?: string
      submenu?: unknown
    }>
    const view = template.find(item => item.label === 'menu:view.label')!
    const items = view.submenu as Array<{
      label?: string
      enabled?: boolean
      accelerator?: string
      click?: () => void
    }>
    const assistant = items.find(item => item.label === 'ui:ai.title')!
    expect(assistant.accelerator).toBe('CommandOrControl+L')
    expect(assistant.enabled).toBe(kind !== null)
    if (kind) {
      assistant.click!()
      expect(send).toHaveBeenLastCalledWith('main-menu:open-ai')
    }
  },
)
