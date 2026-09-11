import type { ComponentOptions } from 'vue'
import { expect, it, vi } from 'vitest'
import {
  computed,
  createRenderer,
  defineComponent,
  nextTick,
  ref,
  ssrContextKey,
  watch,
} from 'vue'

Object.assign(globalThis, { computed, ref, watch })
vi.mock('@/electron', () => ({
  i18n: { t: (key: string) => key },
  ipc: { invoke: vi.fn() },
}))
vi.mock('@/composables', () => ({ useHttpSettings: () => ({ settings: {} }) }))
vi.mock('@/components/ui/shadcn/select', () => ({}))

it('keeps legacy form bytes until an actual row edit and persists nested edits', async () => {
  const component = (await import('../RequestBodyTab.vue'))
    .default as ComponentOptions
  const draft = ref({
    method: 'POST',
    bodyType: 'form-urlencoded',
    body: 'a=hello+world&raw=%2f',
    formData: [],
  })
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
  let state: any
  const app = renderer.createApp(
    defineComponent({
      ...component,
      setup(props, context) {
        state = component.setup!(props, context)
        return () => null
      },
    }),
    {
      'modelValue': draft.value,
      'onUpdate:modelValue': (value: typeof draft.value) => {
        draft.value = value
      },
    },
  )
  app.provide(ssrContextKey, {})
  app.mount({})
  try {
    await nextTick()
    expect(draft.value.body).toBe('a=hello+world&raw=%2f')
    state.formEntries.value[0].description = 'edited'
    await nextTick()
    expect(draft.value.body).toBeNull()
    expect(draft.value.formData[0]).toMatchObject({
      key: 'a',
      value: 'hello world',
      description: 'edited',
    })
    state.formEntries.value[1].enabled = false
    await nextTick()
    expect(draft.value.formData[1]).toMatchObject({
      key: 'raw',
      value: '/',
      enabled: false,
    })
  }
  finally {
    app.unmount()
  }
})
