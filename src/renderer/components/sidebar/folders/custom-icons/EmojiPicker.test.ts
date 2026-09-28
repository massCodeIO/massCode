import { renderToString } from '@vue/server-renderer'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import {
  computed,
  createSSRApp,
  defineComponent,
  h,
  nextTick,
  ref,
  useTemplateRef,
  watch,
} from 'vue'
import EmojiPicker from './EmojiPicker.vue'

vi.mock('@/electron', () => ({
  i18n: { t: (key: string) => key },
}))

vi.mock('vue-virtual-scroller', () => ({
  RecycleScroller: defineComponent({
    inheritAttrs: false,
    props: {
      items: { type: Array, default: () => [] },
    },
    setup(props, { slots }) {
      return () => [
        slots.default?.(),
        slots.default?.({ item: props.items[0] }),
      ]
    },
  }),
}))

describe('emoji picker', () => {
  beforeAll(() => {
    vi.stubGlobal('computed', computed)
    vi.stubGlobal('nextTick', nextTick)
    vi.stubGlobal('ref', ref)
    vi.stubGlobal('useTemplateRef', useTemplateRef)
    vi.stubGlobal('watch', watch)
  })

  it('handles a virtual-scroller slot render without item props', async () => {
    const app = createSSRApp(EmojiPicker)
    app.component(
      'UiInput',
      defineComponent(() => () => h('input')),
    )
    app.component(
      'UiText',
      defineComponent(
        (_, { slots }) =>
          () =>
            h('span', slots.default?.()),
      ),
    )

    await expect(renderToString(app)).resolves.toContain(
      'folder.iconPicker.emojiCategories.people',
    )
  })
})
