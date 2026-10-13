import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, reactive, ref, shallowRef, watch } from 'vue'

Object.assign(globalThis, {
  computed,
  nextTick,
  reactive,
  ref,
  shallowRef,
  watch,
  window: new EventTarget(),
})

const recent = [
  {
    id: 'space:notes',
    target: 'space',
    targetId: 'notes',
    title: 'Notes',
    subtitle: '',
    spaceId: 'notes',
    openedAt: 3,
  },
  {
    id: 'snippet:1',
    target: 'snippet',
    targetId: '1',
    title: 'Old snippet',
    subtitle: 'Library',
    spaceId: 'code',
    openedAt: 2,
  },
  {
    id: 'note:2',
    target: 'note',
    targetId: '2',
    title: 'Old note',
    subtitle: 'Library',
    spaceId: 'notes',
    openedAt: 1,
  },
  {
    id: 'http-request:3',
    target: 'http-request',
    targetId: '3',
    title: 'Old request',
    subtitle: '',
    spaceId: 'http',
    openedAt: 0,
  },
]

const usage = [
  {
    id: 'space:notes',
    target: 'space',
    targetId: 'notes',
    openedAt: 3,
    openCount: 1,
  },
  {
    id: 'command:new',
    target: 'command',
    targetId: 'new',
    openedAt: 2,
    openCount: 1,
  },
  {
    id: 'snippet:1',
    target: 'snippet',
    targetId: '1',
    openedAt: 1,
    openCount: 4,
  },
]

interface SetupOptions {
  api?: Record<string, unknown>
  recordNavigation?: () => Promise<unknown>
}

async function setup({ api = {}, recordNavigation }: SetupOptions = {}) {
  vi.resetModules()
  const appStore = new Map<string, unknown>([
    ['commandPalette.recent', recent],
    ['commandPalette.usage', usage],
  ])
  const sonner = vi.fn()
  const empty = () => ({})

  vi.doMock('@/electron', () => ({
    i18n: { t: (key: string) => key },
    store: {
      app: {
        get: (key: string) => appStore.get(key),
        set: (key: string, value: unknown) => appStore.set(key, value),
      },
    },
  }))
  vi.doMock('@/composables/useSonner', () => ({
    useSonner: () => ({ sonner }),
  }))
  vi.doMock('@/composables/spaces/http', () => ({
    useHttpApp: empty,
    useHttpFolders: empty,
    useHttpRequests: empty,
    useHttpSearch: empty,
  }))
  vi.doMock('@/composables/spaces/http/runtimeNavigation', () => ({
    httpRuntimeNavigation: { confirmLeave: async () => true },
  }))
  vi.doMock('@/composables/spaces/notes', () => ({
    useNotes: empty,
    useNotesApp: empty,
    useNoteSearch: empty,
  }))
  vi.doMock('@/composables/useImportDialog', () => ({
    useImportDialog: empty,
  }))
  vi.doMock('@/router', () => ({ router: {}, RouterName: {} }))
  vi.doMock('@/services/api', () => ({ api }))
  vi.doMock('@/composables/useNavigationHistory', () => ({
    useNavigationHistory: () => ({ recordNavigation }),
  }))
  vi.doMock('@/spaceDefinitions', () => ({
    getActiveSpaceId: () => undefined,
    getSpaceDefinitions: () =>
      ['code', 'notes', 'http'].map(id => ({ id, icon: {} })),
  }))
  vi.doMock('../command-palette/httpCommands', () => ({
    createHttpRequestFromPalette: vi.fn(),
    getHttpCommands: () => [],
  }))

  const { useCommandPalette } = await import('../useCommandPalette')
  return { appStore, palette: useCommandPalette(), sonner }
}

function getRecentIds(appStore: Map<string, unknown>) {
  return (appStore.get('commandPalette.recent') as { id: string }[]).map(
    entry => entry.id,
  )
}

function getUsageIds(appStore: Map<string, unknown>) {
  return (appStore.get('commandPalette.usage') as { id: string }[]).map(
    entry => entry.id,
  )
}

function notFound() {
  return Promise.reject(
    Object.assign(new Error('Not found'), { response: { status: 404 } }),
  )
}

function getRecentResult(id: string) {
  const entry = recent.find(item => item.id === id)!
  return {
    id: `recent:${id}`,
    type: 'recent',
    title: entry.title,
    subtitle: entry.subtitle,
    icon: {},
    recent: entry,
  } as never
}

describe('useCommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps only vault-independent history after vault reset', async () => {
    const { appStore, palette } = await setup()

    palette.resetVaultHistory()

    expect(palette.recentResults.value.map(result => result.id)).toEqual([
      'recent:space:notes',
    ])
    expect(getRecentIds(appStore)).toEqual(['space:notes'])
    expect(getUsageIds(appStore)).toEqual(['space:notes', 'command:new'])
    expect(palette.usageById.value.has('snippet:1')).toBe(false)
  })

  it.each([
    {
      id: 'snippet:1',
      api: { snippets: { getSnippetsById: vi.fn(notFound) } },
      read: (api: any) => api.snippets.getSnippetsById,
      message: 'internalLinks.missing.snippet',
    },
    {
      id: 'note:2',
      api: { notes: { getNotesById: vi.fn(notFound) } },
      read: (api: any) => api.notes.getNotesById,
      message: 'internalLinks.missing.note',
    },
    {
      id: 'http-request:3',
      api: { httpRequests: { getHttpRequestsById: vi.fn(notFound) } },
      read: (api: any) => api.httpRequests.getHttpRequestsById,
      message: 'internalLinks.missing.httpRequest',
    },
  ])(
    'forgets a missing $id recent entry',
    async ({ id, api, read, message }) => {
      const { appStore, palette, sonner } = await setup({ api })
      palette.isOpen.value = true

      await palette.openResult(getRecentResult(id))

      expect(read(api)).toHaveBeenCalledWith(id.split(':')[1])
      expect(palette.isOpen.value).toBe(false)
      expect(getRecentIds(appStore)).not.toContain(id)
      expect(getRecentIds(appStore)).toHaveLength(recent.length - 1)
      expect(getUsageIds(appStore)).not.toContain(id)
      expect(sonner).toHaveBeenCalledWith({ message, type: 'warning' })
    },
  )

  it('keeps the entry when opening a loaded target fails with 404', async () => {
    const { appStore, palette, sonner } = await setup({
      api: {
        snippets: { getSnippetsById: async () => ({ data: { id: 1 } }) },
      },
      recordNavigation: notFound,
    })

    await expect(
      palette.openResult(getRecentResult('snippet:1')),
    ).rejects.toMatchObject({ response: { status: 404 } })

    expect(getRecentIds(appStore)).toEqual(recent.map(item => item.id))
    expect(getUsageIds(appStore)).toEqual(usage.map(item => item.id))
    expect(sonner).not.toHaveBeenCalled()
  })

  it('rethrows unexpected errors without forgetting the entry', async () => {
    const error = Object.assign(new Error('Server error'), {
      response: { status: 500 },
    })
    const { appStore, palette, sonner } = await setup({
      api: { snippets: { getSnippetsById: () => Promise.reject(error) } },
    })

    await expect(palette.openResult(getRecentResult('snippet:1'))).rejects.toBe(
      error,
    )

    expect(getRecentIds(appStore)).toEqual(recent.map(item => item.id))
    expect(sonner).not.toHaveBeenCalled()
  })
})
