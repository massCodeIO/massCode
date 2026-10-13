import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  computed,
  createRenderer,
  defineComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  ssrContextKey,
  useTemplateRef,
} from 'vue'

Object.assign(globalThis, {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  useTemplateRef,
})
const cleanup: Array<() => void> = []

interface IpcResults {
  setVaultPath?: () => unknown
  moveVault?: () => unknown
}

async function setup(results: IpcResults) {
  vi.resetModules()
  const preferences = new Map<string, unknown>([
    ['storage.rootPath', '/storage'],
    ['storage', { vaultPath: '/vault-a' }],
    ['storage.vaultPath', '/vault-a'],
  ])
  const resetVaultHistory = vi.fn()
  const clearHistory = vi.fn()
  const loaded = async () => true

  vi.doMock('@/electron', () => ({
    i18n: { t: (key: string) => key },
    store: { preferences: { get: (key: string) => preferences.get(key) } },
    ipc: {
      invoke: async (channel: string) => {
        if (channel === 'main-menu:open-dialog')
          return '/vault-b'
        if (channel === 'system:get-directory-state')
          return { exists: true, isEmpty: true }
        if (channel === 'system:set-vault-path')
          return results.setVaultPath!()
        if (channel === 'system:move-vault')
          return results.moveVault!()
      },
    },
  }))
  vi.doMock('@/composables', () => ({
    resetCodeSpaceInitialization: vi.fn(),
    resetHttpSpaceState: vi.fn(),
    resetNotesSpaceInitialization: vi.fn(),
    useDialog: () => ({ confirm: async () => true }),
    useDrawings: () => ({ resetDrawings: vi.fn() }),
    useFolders: () => ({ getFolders: loaded }),
    useHttpEnvironments: () => ({ getHttpEnvironments: loaded }),
    useHttpFolders: () => ({ getHttpFolders: loaded }),
    useHttpHistory: () => ({ getHttpHistory: loaded }),
    useHttpRequests: () => ({ getHttpRequests: loaded }),
    useMathNotebook: () => ({ reset: vi.fn() }),
    useNavigationHistory: () => ({ clearHistory }),
    useNoteFolders: () => ({ resetNoteFoldersState: vi.fn() }),
    useNotes: () => ({ clearNotesState: vi.fn(), getNotes: loaded }),
    useNoteTags: () => ({ resetNoteTags: vi.fn() }),
    useSnippets: () => ({ getSnippets: loaded }),
    useSonner: () => ({ sonner: vi.fn(), dismiss: vi.fn() }),
    useVaultDoctor: () => ({
      report: ref(),
      warningPreview: ref([]),
      conflictCount: ref(0),
      scan: vi.fn(),
      reset: vi.fn(),
    }),
    VAULT_DOCTOR_NOTICE_ID: 'vault-doctor',
  }))
  vi.doMock('@/composables/useCommandPalette', () => ({
    useCommandPalette: () => ({ resetVaultHistory }),
  }))
  vi.doMock('@/composables/ai/nativePreferenceFlows', () => ({
    cancelPreferenceHandoff: vi.fn(),
    claimPreferenceHandoff: vi.fn(),
    finishPreferenceHandoff: vi.fn(),
    preferenceHandoff: ref(),
    registerPreferenceFlow: () => vi.fn(),
    waitForPreferenceUser: vi.fn(),
  }))
  vi.doMock('@/composables/spaces/http/runtimeNavigation', () => ({
    httpRuntimeNavigation: { confirmLeave: async () => true },
  }))
  vi.doMock('vue-router', () => ({
    useRoute: () => ({ query: {} }),
    useRouter: () => ({ replace: vi.fn() }),
  }))
  vi.doMock('~/renderer/services/api', () => ({
    api: {
      snippets: {
        getSnippetsCounts: async () => ({ data: { total: 0, trash: 0 } }),
      },
    },
  }))

  const Storage = (await import('../Storage.vue')).default
  const renderer = createRenderer({
    patchProp() {},
    insert() {},
    remove() {},
    createElement: () => ({}),
    createText: () => ({}),
    createComment: () => ({}),
    setText() {},
    setElementText() {},
    parentNode: () => null,
    nextSibling: () => null,
  })
  let bindings!: {
    openVaultStorage: () => Promise<{ status: string }>
    moveVaultStorage: () => Promise<{ status: string }>
  }
  const app = renderer.createApp(
    defineComponent({
      setup() {
        bindings = Storage.setup!({}, { expose() {} } as never) as never
        return () => null
      },
    }),
  )
  app.provide(ssrContextKey, {})
  app.mount({})
  cleanup.push(() => app.unmount())

  return { bindings, clearHistory, preferences, resetVaultHistory }
}

afterEach(() => {
  cleanup.splice(0).forEach(dispose => dispose())
})

describe('storage vault switch history', () => {
  it('resets palette and navigation history after opening another vault', async () => {
    const { bindings, clearHistory, resetVaultHistory } = await setup({
      setVaultPath: () => ({ vaultPath: '/vault-b' }),
    })

    await bindings.openVaultStorage()

    expect(resetVaultHistory).toHaveBeenCalledOnce()
    expect(clearHistory).toHaveBeenCalledOnce()
  })

  it('keeps history after reopening the current vault', async () => {
    const { bindings, clearHistory, resetVaultHistory } = await setup({
      setVaultPath: () => ({ vaultPath: '/vault-a' }),
    })

    await bindings.openVaultStorage()

    expect(resetVaultHistory).not.toHaveBeenCalled()
    expect(clearHistory).not.toHaveBeenCalled()
  })

  it('keeps history after moving the same vault', async () => {
    const { bindings, clearHistory, resetVaultHistory } = await setup({
      moveVault: () => ({ vaultPath: '/vault-b' }),
    })

    await bindings.moveVaultStorage()

    expect(resetVaultHistory).not.toHaveBeenCalled()
    expect(clearHistory).not.toHaveBeenCalled()
  })

  it('keeps history when a failed switch rolls back to the previous vault', async () => {
    const { bindings, clearHistory, resetVaultHistory } = await setup({
      setVaultPath: () => {
        throw new Error('watcher failed')
      },
    })

    const result = await bindings.openVaultStorage()

    expect(result.status).toBe('failed')
    expect(resetVaultHistory).not.toHaveBeenCalled()
    expect(clearHistory).not.toHaveBeenCalled()
  })

  it('resets history when a failed switch leaves the new vault active', async () => {
    const { bindings, clearHistory, preferences, resetVaultHistory }
      = await setup({
        setVaultPath: () => {
          preferences.set('storage.vaultPath', '/vault-b')
          throw new Error('watcher failed')
        },
      })

    await bindings.openVaultStorage()

    expect(resetVaultHistory).toHaveBeenCalledOnce()
    expect(clearHistory).toHaveBeenCalledOnce()
  })
})
