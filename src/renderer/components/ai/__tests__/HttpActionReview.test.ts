import { renderToString } from '@vue/server-renderer'
import { expect, it, vi } from 'vitest'
import {
  computed,
  createRenderer,
  createSSRApp,
  defineComponent,
  h,
  nextTick,
  reactive,
  ref,
  ssrContextKey,
} from 'vue'
import HttpActionReview from '../HttpActionReview.vue'

Object.assign(globalThis, { computed, ref })
const actions = vi.hoisted(() => ({ apply: vi.fn(), cancel: vi.fn() }))
vi.mock('@/composables/ai/useAi', () => ({
  useAi: () => ({
    applyHttpAction: actions.apply,
    cancelHttpAction: actions.cancel,
    canPerformHttpAction: () => true,
  }),
}))
vi.mock('@/composables/spaces/http/useHttpRunner', () => ({
  useHttpRunner: () => ({}),
}))
vi.mock('@/electron', () => ({
  i18n: { t: (key: string) => key },
  store: { preferences: { get: () => '/vault' } },
}))
vi.mock('@/components/ui/shadcn/button', () => ({
  Button: defineComponent({
    setup:
      (_, { attrs, slots }) =>
        () =>
          h('button', attrs, slots.default?.()),
  }),
}))

it.each(['cancelled', 'failed'] as const)(
  'keeps Stop available during Apply and distinguishes terminal %s from an execution error',
  async (terminal) => {
    actions.apply.mockReset()
    actions.cancel.mockReset()
    // Same setup-only renderer convention as TreeNodeInteraction; SSR verifies
    // the actual template disabled binding without adding a DOM test dependency.
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
    const action = reactive({
      id: 'action',
      action: 'send',
      source: 'saved',
      state: 'pending',
      summary: 'Send',
      preview: {},
    })
    const props = { action, message: {} }
    let bindings: any
    let applied!: (success: boolean) => void
    let cancelled!: () => void
    actions.apply.mockImplementationOnce(() => {
      action.state = 'running'
      return new Promise<boolean>((resolve) => {
        applied = resolve
      })
    })
    actions.cancel.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          cancelled = resolve
        }),
    )
    const app = renderer.createApp(
      defineComponent({
        setup() {
          bindings = HttpActionReview.setup!(
            props as never,
            { expose() {} } as never,
          )
          return () => null
        },
      }),
    )
    app.provide(ssrContextKey, {})
    app.mount({})
    const render = () => {
      const ssr = createSSRApp(
        { ...HttpActionReview, setup: () => bindings },
        props,
      )
      ssr.component(
        'UiText',
        defineComponent({
          setup:
            (_, { slots }) =>
              () =>
                h('span', slots.default?.()),
        }),
      )
      ssr.component(
        'AiHttpRequestPreview',
        defineComponent({ render: () => null }),
      )
      return renderToString(ssr)
    }
    try {
      const applying = bindings.apply()
      await nextTick()
      expect(await render()).toMatch(
        /<button(?![^>]*disabled)[^>]*>ai.httpActions.stopActivity<\/button>/,
      )
      const stopping = bindings.cancel()
      await nextTick()
      expect(await render()).toMatch(
        /<button[^>]*disabled[^>]*>ai.httpActions.stopActivity<\/button>/,
      )
      await bindings.cancel()
      await bindings.apply()
      expect(actions.cancel).toHaveBeenCalledExactlyOnceWith(action)
      expect(actions.apply).toHaveBeenCalledExactlyOnceWith(
        props.message,
        action,
        true,
      )
      action.state = terminal
      cancelled()
      applied(false)
      await Promise.all([applying, stopping])
      const html = await render()
      expect(html).not.toContain('ai.httpActions.stopActivity')
      if (terminal === 'cancelled')
        expect(html).not.toContain('ai.httpActions.failed')
      else expect(html).toContain('ai.httpActions.failed')
    }
    finally {
      app.unmount()
    }
  },
)
