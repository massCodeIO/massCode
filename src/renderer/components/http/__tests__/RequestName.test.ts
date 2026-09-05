import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  computed,
  createRenderer,
  defineComponent,
  nextTick,
  onBeforeUnmount,
  ref,
  ssrContextKey,
  watch,
} from 'vue'

Object.assign(globalThis, { computed, ref, watch, onBeforeUnmount })
const cleanup: Array<() => void> = []

async function setup() {
  vi.resetModules()
  const currentRequest = ref({ id: 1, name: 'Original', folderId: null })
  const updateHttpRequest = vi.fn(
    async (id: number, data: { name: string }) => {
      if (currentRequest.value.id === id)
        currentRequest.value = { ...currentRequest.value, ...data }
      return true
    },
  )
  vi.doMock('@/composables/spaces/http/useHttpRequests', () => ({
    useHttpRequests: () => ({
      currentRequest,
      updateHttpRequest,
      hasSiblingRequestNameConflict: (name: string) => name === 'Taken',
    }),
  }))
  vi.doMock('@/composables/spaces/http/useHttpApp', () => ({
    useHttpApp: () => ({ isFocusedRequestName: ref(false) }),
  }))
  vi.doMock('@/electron', () => ({ i18n: { t: (key: string) => key } }))
  vi.doMock('@/utils', () => ({
    getEntryNameValidationMessage: (value: string) => (value ? '' : 'empty'),
    getEntryNameConflictMessage: () => 'conflict',
  }))
  const RequestName = (await import('../RequestName.vue')).default
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
  let input!: {
    type: (value: string) => void
    blur: () => void
    value: () => string
  }
  const app = renderer.createApp(
    defineComponent({
      setup() {
        const bindings = RequestName.setup!({}, { expose() {} } as never) as {
          name: { value: string }
          focusName: () => void
          blurName: () => void
        }
        input = {
          type(value) {
            bindings.focusName()
            bindings.name.value = value
          },
          blur: bindings.blurName,
          value: () => bindings.name.value,
        }
        return () => null
      },
    }),
  )
  app.provide(ssrContextKey, {})
  app.mount({})
  cleanup.push(() => app.unmount())
  return { input, currentRequest, updateHttpRequest }
}

afterEach(() => {
  cleanup.splice(0).forEach(dispose => dispose())
  vi.useRealTimers()
})

describe('hTTP request name autosave', () => {
  it('uses the editable field to debounce valid names and reject conflicts', async () => {
    const { input, updateHttpRequest } = await setup()
    vi.useFakeTimers()
    input.type('First')
    input.type('Final')
    expect(updateHttpRequest).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(500)
    expect(updateHttpRequest).toHaveBeenCalledExactlyOnceWith(1, {
      name: 'Final',
    })
    input.type('Taken')
    input.blur()
    await vi.advanceTimersByTimeAsync(500)
    await nextTick()
    expect(updateHttpRequest).toHaveBeenCalledTimes(1)
    expect(input.value()).toBe('Final')
  })

  it('keeps a pending rename attached to its request when selection changes', async () => {
    const { input, currentRequest, updateHttpRequest } = await setup()
    vi.useFakeTimers()
    input.type('Renamed A')
    currentRequest.value = { id: 2, name: 'Request B', folderId: null }
    await nextTick()
    input.type('Renamed B')
    await vi.advanceTimersByTimeAsync(500)
    expect(updateHttpRequest.mock.calls).toEqual([
      [1, { name: 'Renamed A' }],
      [2, { name: 'Renamed B' }],
    ])
  })
})
