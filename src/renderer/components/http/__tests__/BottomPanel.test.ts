import type { Ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  computed,
  createRenderer,
  defineComponent,
  nextTick,
  reactive,
  ref,
  ssrContextKey,
  watch,
} from 'vue'

Object.assign(globalThis, { computed, ref, watch })
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
  const invoke = vi.fn(
    () =>
      new Promise<string>((resolve, reject) =>
        pending.push({ resolve, reject }),
      ),
  )
  vi.doMock('@/electron', () => ({
    i18n: { t: (key: string) => key },
    ipc: { invoke },
  }))
  vi.doMock('@/composables', () => ({
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
    useCopyToClipboard: () => vi.fn(),
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
  return { state, settings, currentDraft, pending }
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
