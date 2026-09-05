import { renderToString } from '@vue/server-renderer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, createSSRApp, h, ref } from 'vue'
import Steps from '../runner/Steps.vue'
import RuntimeResultGroup from '../RuntimeResultGroup.vue'

const state = vi.hoisted(() => ({
  view: { value: null as any },
  running: { value: false },
  reorderSteps: vi.fn(),
}))
vi.mock('@/composables/spaces/http/useHttpRunner', () => ({
  useHttpRunner: () => state,
}))
vi.mock('@/electron', () => ({ i18n: { t: (key: string) => key } }))
vi.mock('vuedraggable', () => ({
  default: {
    props: ['modelValue'],
    setup:
      (props: any, { slots }: any) =>
        () =>
          h(
            'div',
            props.modelValue.map((element: any, index: number) =>
              slots.item({ element, index }),
            ),
          ),
  },
}))
Object.assign(globalThis, { computed })

async function renderSteps() {
  const app = createSSRApp(Steps)
  app.component('HttpRuntimeResultGroup', RuntimeResultGroup)
  app.component('UiText', {
    setup:
      (_, { slots }) =>
        () =>
          h('span', slots.default?.()),
  })
  app.component('UiActionButton', {
    setup:
      (_, { slots }) =>
        () =>
          h('button', slots.default?.()),
  })
  app.component('HttpMethodBadge', {
    props: ['method'],
    setup: props => () => h('span', props.method),
  })
  return (await renderToString(app)).replace(/\s+/g, ' ')
}

beforeEach(() => {
  state.running = ref(false)
  state.view = ref({
    state: 'ready',
    steps: [
      {
        requestId: 1,
        name: 'Local request',
        folderPath: 'Demo',
        method: 'GET',
        state: 'pending',
      },
    ],
  })
})

describe('runner result presentation', () => {
  it('keeps the drag handle in preparation without empty result groups', async () => {
    const html = await renderSteps()
    expect(html).toContain('spaces.http.runner.reorder')
    expect(html).not.toContain('spaces.http.runtime.assertions')
    expect(html).not.toContain('spaces.http.runtime.extractionResults')
  })

  it('renders mixed results using the same groups and badges as response tests', async () => {
    state.view.value.state = 'failed'
    Object.assign(state.view.value.steps[0], {
      state: 'failed',
      assertions: [
        { index: 0, name: 'Status OK', ok: true },
        { index: 1, name: 'Payload OK', ok: false, errorCode: 'missing' },
      ],
      extractions: [
        { index: 0, name: 'Token', ok: false, errorCode: 'missing' },
      ],
    })
    const html = await renderSteps()
    expect(html).not.toContain('spaces.http.runner.reorder')
    expect(html).toContain('spaces.http.runtime.assertions')
    expect(html).toContain('spaces.http.runtime.extractionResults')
    expect(html).toContain('Status OK')
    expect(html).toContain('Payload OK')
    expect(html).toContain('Token')
    expect(html).toContain('spaces.http.runtime.errors.missing')
    expect(html).toContain('bg-destructive/5')
    expect(html).toContain('bg-success/10 text-success')
    expect(html).toContain('bg-destructive/10 text-destructive')
    const icons
      = html.match(/<svg[^>]+class="[^"]*lucide-circle-(?:check|x)[^"]*"/g) ?? []
    expect(icons).toHaveLength(4)
    for (const icon of icons) {
      expect(icon).toContain('size-4')
      expect(icon).not.toContain('size-3.5')
    }
  })
})
