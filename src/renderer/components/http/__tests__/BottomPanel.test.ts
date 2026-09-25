import type { Ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  computed,
  createRenderer,
  defineComponent,
  nextTick,
  onMounted,
  onScopeDispose,
  reactive,
  ref,
  ssrContextKey,
  watch,
} from 'vue'

Object.assign(globalThis, {
  computed,
  ref,
  watch,
  onMounted,
  onScopeDispose,
  nextTick,
})
const cleanup: Array<() => void> = []

afterEach(() => cleanup.splice(0).forEach(dispose => dispose()))

async function setup() {
  vi.resetModules()
  const settings = reactive({
    defaultPreviewFormat: 'curl',
    autoSwitchToResponse: false,
  })
  const currentDraft = ref({
    method: 'GET',
    url: 'https://example.com',
    headers: [],
    query: [],
    formData: [],
    bodyType: 'none',
    body: null,
    auth: { type: 'none' },
  })
  const pending: Array<{
    resolve: (value: string) => void
    reject: (error: Error) => void
  }> = []
  let native: (action: any, current: () => boolean) => Promise<any>
  const copy = vi.fn(async (_value: string) => true)
  vi.doMock('@/composables/ai/nativeBridges', () => ({
    useNativeHttpPanelBridge: (_key: string, handler: typeof native) => {
      native = handler
    },
    runHttpResponseBridge: vi.fn(),
  }))
  vi.doMock('@/composables/ai/nativePreferences', () => ({
    setNativePreferences: async (change: any) => {
      settings.defaultPreviewFormat = change.values.defaultPreviewFormat
      await nextTick()
      return {
        status: 'done',
        persisted: true,
        mutation: {
          kind: 'preferences',
          group: 'http',
          before: {},
          after: change.values,
        },
      }
    },
  }))
  const invoke = vi.fn((channel: string) =>
    channel === 'spaces:http:cookies:preview'
      ? Promise.resolve('')
      : new Promise<string>((resolve, reject) =>
        pending.push({ resolve, reject }),
      ),
  )
  vi.doMock('@/electron', () => ({
    i18n: { t: (key: string) => key },
    ipc: { invoke, on: vi.fn(), removeListeners: vi.fn() },
  }))
  vi.doMock('@/composables/spaces/http/useHttpRuntime', () => ({
    useHttpRuntime: () => ({ draft: ref({}) }),
  }))
  vi.doMock('@/composables/spaces/http/useHttpHistory', () => ({
    useHttpHistory: () => ({ history: ref([]), getHttpHistory: vi.fn() }),
  }))
  vi.doMock('@/composables', () => ({
    useHttpFolders: () => ({ folders: ref([]) }),
    useHttpRequests: () => ({
      currentDraft,
      currentRequest: ref({ name: 'Request' }),
    }),
    useHttpEnvironments: () => ({ activeEnvironmentVariables: ref({}) }),
    useHttpExecute: () => ({
      isExecuting: ref(false),
      lastError: ref(null),
      lastResponse: ref(null),
    }),
    useHttpSettings: () => ({ settings }),
    useCopyToClipboard: () => copy,
    useDonations: () => ({ incrementCopy: vi.fn() }),
  }))
  vi.doMock('@/components/ui/shadcn/tabs', () => ({}))
  vi.doMock('@/components/ui/shadcn/checkbox', () => ({ Checkbox: {} }))
  const component = (await import('../BottomPanel.vue')).default
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
  let state!: {
    previewContent: Ref<string>
    displayedFormat: Ref<string>
    previewPending: Ref<boolean>
    interpolateVariables: Ref<boolean>
    previewError: Ref<boolean>
  }
  const app = renderer.createApp(
    defineComponent({
      setup() {
        state = component.setup!({}, { expose() {} } as never) as typeof state
        return () => null
      },
    }),
  )
  app.provide(ssrContextKey, {})
  app.mount({})
  cleanup.push(() => app.unmount())
  return { state, settings, currentDraft, pending, copy, native: native! }
}

describe('request preview transitions', () => {
  it('keeps the previous code and language until the next client is ready', async () => {
    const { state, settings, pending } = await setup()
    const previous = state.previewContent.value
    expect(previous).toContain('curl')
    settings.defaultPreviewFormat = 'shell:httpie'
    await nextTick()
    expect(state.previewContent.value).toBe(previous)
    expect(state.displayedFormat.value).toBe('curl')
    expect(state.previewPending.value).toBe(true)
    pending[0]!.resolve('http GET https://example.com')
    await nextTick()
    expect(state.previewContent.value).toBe('http GET https://example.com')
    expect(state.displayedFormat.value).toBe('shell:httpie')
    expect(state.previewPending.value).toBe(false)
  })

  it('ignores a stale generation after switching clients again', async () => {
    const { state, settings, pending } = await setup()
    settings.defaultPreviewFormat = 'shell:httpie'
    await nextTick()
    settings.defaultPreviewFormat = 'shell:wget'
    await nextTick()
    pending[1]!.resolve('wget https://example.com')
    await nextTick()
    pending[0]!.resolve('stale HTTPie')
    await nextTick()
    expect(state.previewContent.value).toBe('wget https://example.com')
    expect(state.displayedFormat.value).toBe('shell:wget')
    expect(state.previewPending.value).toBe(false)
  })

  it('clears outdated code on failure and when the URL is removed', async () => {
    const { state, settings, currentDraft, pending } = await setup()
    settings.defaultPreviewFormat = 'shell:httpie'
    await nextTick()
    pending[0]!.reject(new Error('generation failed'))
    await nextTick()
    expect(state.previewContent.value).toBe('')
    expect(state.previewError.value).toBe(true)
    expect(state.previewPending.value).toBe(false)
    currentDraft.value.url = ''
    await nextTick()
    expect(state.previewError.value).toBe(false)
    expect(state.previewContent.value).toBe('')
  })
})

it('waits for actual native preview generation and clipboard completion, retaining format Undo', async () => {
  const { native, pending, copy } = await setup()
  const result = native(
    {
      action: 'httpView',
      target: { space: 'http', id: 1 },
      panel: 'preview',
      format: 'shell:httpie',
      copy: true,
    },
    () => true,
  )
  await vi.waitFor(() => expect(pending.length).toBe(1))
  expect(copy).not.toHaveBeenCalled()
  pending[0]!.resolve('generated HTTPie')
  expect(await result).toMatchObject({
    status: 'done',
    characters: 16,
    mutation: { kind: 'preferences' },
  })
  expect(copy).toHaveBeenCalledWith('generated HTTPie')
})
it('does not copy a previous preview after generation failure or loss of target', async () => {
  const { native, pending, copy } = await setup()
  let current = true
  const result = native(
    {
      action: 'httpView',
      target: { space: 'http', id: 1 },
      panel: 'preview',
      format: 'shell:httpie',
      copy: true,
    },
    () => current,
  )
  await vi.waitFor(() => expect(pending.length).toBe(1))
  current = false
  pending[0]!.resolve('new preview')
  expect(await result).toMatchObject({ status: 'stale' })
  expect(copy).not.toHaveBeenCalled()
})
it('regenerates the native preview when interpolation changes without copying old output', async () => {
  const { native, pending, copy, state, settings } = await setup()
  settings.defaultPreviewFormat = 'shell:httpie'
  await vi.waitFor(() => expect(pending.length).toBe(1))
  pending[0]!.resolve('interpolated')
  await nextTick()
  const result = native(
    {
      action: 'httpView',
      target: { space: 'http', id: 1 },
      panel: 'preview',
      interpolate: false,
      copy: true,
    },
    () => true,
  )
  await vi.waitFor(() => expect(pending.length).toBe(2))
  expect(copy).not.toHaveBeenCalled()
  expect(state.interpolateVariables.value).toBe(false)
  pending[1]!.resolve('without interpolation')
  expect(await result).toMatchObject({ status: 'done' })
  expect(copy).toHaveBeenCalledWith('without interpolation')
})
