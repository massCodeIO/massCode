import { beforeEach, expect, it, vi } from 'vitest'
import { createHttpRequestFromPalette, getHttpCommands } from '../httpCommands'

const state = vi.hoisted(() => ({
  space: 'http',
  route: 'http',
  allowed: true,
  selection: { activePanel: 'request', requestId: 1, folderId: 10 } as any,
  request: { value: { id: 1, folderId: 10, runtimeState: 'ready' } as any },
  draft: { value: { url: 'https://example.test', protocol: 'http' } as any },
  loading: { value: false },
  runner: {
    running: { value: false },
    preparing: { value: false },
    openRunner: vi.fn(),
  },
  ui: {
    requestSettingsVersion: { value: 0 },
    dockOpen: { value: false },
    dockTab: { value: 'console' },
    cookiesOpen: { value: false },
    environmentsOpen: { value: false },
  },
  create: vi.fn(),
  folder: vi.fn(),
  clear: vi.fn(),
  import: vi.fn(),
}))
vi.mock('@/electron', () => ({ i18n: { t: (key: string) => key } }))
vi.mock('@/spaceDefinitions', () => ({ getActiveSpaceId: () => state.space }))
vi.mock('@/router', () => ({
  RouterName: { httpSpace: 'http', preferencesHttp: 'preferences/http' },
  router: {
    currentRoute: {
      get value() {
        return { name: state.route }
      },
    },
    push: async (target: any) => {
      state.route = target.name
    },
  },
}))
vi.mock('../../spaces/http/runtimeNavigation', () => ({
  httpRuntimeNavigation: { confirmLeave: async () => state.allowed },
}))
vi.mock('../../spaces/http/useHttpApp', () => ({
  useHttpApp: () => ({ httpState: state.selection }),
}))
vi.mock('../../spaces/http/useHttpRequests', () => ({
  useHttpRequests: () => ({
    currentRequest: state.request,
    currentDraft: state.draft,
    isCurrentRequestLoading: state.loading,
    createHttpRequestAndSelect: state.create,
  }),
}))
vi.mock('../../spaces/http/useHttpFolders', () => ({
  useHttpFolders: () => ({ createHttpFolderAndSelect: state.folder }),
}))
vi.mock('../../spaces/http/useHttpSearch', () => ({
  useHttpSearch: () => ({ clearSearch: state.clear }),
}))
vi.mock('../../spaces/http/useHttpRunner', () => ({
  useHttpRunner: () => state.runner,
}))
vi.mock('../../spaces/http/useHttpUi', () => ({ useHttpUi: () => state.ui }))
vi.mock('../../useHttpImportDialog', () => ({
  useHttpImportDialog: () => ({ openHttpImportDialog: state.import }),
}))
function find(id: string) {
  return getHttpCommands().find(command => command.id === id)
}
beforeEach(() => {
  vi.clearAllMocks()
  state.space = 'http'
  state.route = 'http'
  state.allowed = true
  state.selection = { activePanel: 'request', requestId: 1, folderId: 10 }
  state.request.value = { id: 1, folderId: 10, runtimeState: 'ready' }
  state.draft.value = { url: 'https://example.test', protocol: 'http' }
  state.loading.value = false
})
it('distinguishes root collections and nested folders', async () => {
  await find('new-http-collection')!.run()
  expect(state.folder).toHaveBeenLastCalledWith(undefined)
  await find('new-http-folder')!.run()
  expect(state.folder).toHaveBeenLastCalledWith(10)
})
it('creates requests and WebSockets in the selected folder', async () => {
  await createHttpRequestFromPalette({ url: 'https://example.test' })
  expect(state.create).toHaveBeenCalledWith({
    folderId: 10,
    url: 'https://example.test',
  })
  await find('new-http-websocket')!.run()
  expect(state.create).toHaveBeenLastCalledWith({
    folderId: 10,
    protocol: 'websocket',
  })
})
it('does not create data or clear selection after cancelling the unsaved guard', async () => {
  state.allowed = false
  await createHttpRequestFromPalette()
  await find('new-http-collection')!.run()
  expect(state.create).not.toHaveBeenCalled()
  expect(state.folder).not.toHaveBeenCalled()
  expect(state.clear).not.toHaveBeenCalled()
})
it('does not apply a remembered HTTP folder from another space', async () => {
  state.space = 'notes'
  expect(find('new-http-folder')).toBeUndefined()
  expect(find('send-http-request')).toBeUndefined()
  await createHttpRequestFromPalette()
  expect(state.create).toHaveBeenCalledWith({ folderId: null })
})
it('opens Runner without starting requests', async () => {
  await find('open-http-runner')!.run()
  expect(state.runner.openRunner).toHaveBeenCalledWith(10)
})
it('opens settings, import, and existing HTTP panels', async () => {
  await find('open-http-settings')!.run()
  expect(state.route).toBe('preferences/http')
  await find('import-http-collection')!.run()
  expect(state.import).toHaveBeenCalledOnce()
  await find('open-http-console')!.run()
  expect(state.ui.dockOpen.value).toBe(true)
  expect(state.ui.dockTab.value).toBe('console')
  await find('open-http-terminal')!.run()
  expect(state.ui.dockTab.value).toBe('terminal')
  await find('open-http-cookies')!.run()
  expect(state.ui.cookiesOpen.value).toBe(true)
  await find('open-http-environments')!.run()
  expect(state.ui.environmentsOpen.value).toBe(true)
})

it('does not inherit a stale folder for a root request', async () => {
  state.request.value.folderId = null
  expect(find('new-http-folder')).toBeUndefined()
  await createHttpRequestFromPalette()
  expect(state.create).toHaveBeenCalledWith({ folderId: null })
})

it('keeps request execution and save shortcuts out of the palette', () => {
  const ids = getHttpCommands().map(command => command.id)
  expect(ids).not.toContain('send-http-request')
  expect(ids).not.toContain('save-http-request')
  expect(ids).not.toContain('cancel-http-request')
})
it('opens request settings only for the currently available HTTP request', async () => {
  await find('open-http-request-settings')!.run()
  expect(state.ui.requestSettingsVersion.value).toBe(1)
  state.loading.value = true
  expect(find('open-http-request-settings')).toBeUndefined()
  state.loading.value = false
  state.draft.value.protocol = 'websocket'
  expect(find('open-http-request-settings')).toBeUndefined()
})
