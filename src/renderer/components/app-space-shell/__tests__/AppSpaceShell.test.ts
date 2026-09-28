import { renderToString } from '@vue/server-renderer'
import { expect, it, vi } from 'vitest'
import {
  computed,
  createSSRApp,
  defineComponent,
  h,
  reactive,
  ref,
  watch,
} from 'vue'
import Shell from '../AppSpaceShell.vue'

Object.assign(globalThis, { computed, ref, watch })
const mock = vi.hoisted(() => ({
  route: { name: 'code' },
  stored: vi.fn(),
  set: vi.fn(),
  resize: vi.fn(),
}))
vi.mock('@/composables/ai/useAi', () => ({
  useAi: () => ({ open: ref(true) }),
}))
vi.mock('@/composables/useResizeHandle', () => ({
  useResizeHandle: mock.resize,
}))
vi.mock('@/electron', () => ({
  store: { app: { get: mock.stored, set: mock.set } },
}))
vi.mock('@/router', () => ({
  RouterName: {
    notesDashboard: 'dashboard',
    notesGraph: 'graph',
    notesPresentation: 'presentation',
  },
}))
vi.mock('vue-router', () => ({ useRoute: () => reactive(mock.route) }))
vi.mock('@/spaceDefinitions', () => ({
  getSpaceDefinitions: () => [
    { id: 'code', isActive: (name: string) => name === 'code' },
  ],
}))
vi.mock('@/utils', () => ({ isMac: false }))
it.each([
  ['code', 410, 1],
  ['dashboard', 320, 1],
  ['graph', 320, 1],
  ['presentation', 320, 1],
  ['notesEditor', 0, 0],
  ['http', 0, 0],
] as const)(
  'renders one AI panel only on supported %s page using its saved width',
  async (route, width, count) => {
    mock.set.mockClear()
    mock.route.name = route
    mock.stored.mockImplementation(key =>
      key === 'code.layout.inspectorWidth' ? 410 : 320,
    )
    const app = createSSRApp(Shell, { showRail: route !== 'presentation' })
    app.component(
      'AiPanel',
      defineComponent({ render: () => h('div', { 'data-ai-panel': '' }) }),
    )
    app.component('SpaceRail', defineComponent({ render: () => null }))
    const html = await renderToString(app)
    expect((html.match(/data-ai-panel/g) ?? []).length).toBe(count)
    if (count) {
      expect(html).toContain(`width:${width}px`)
      const resize = mock.resize.mock.calls.at(-1)![1]
      resize.onMove(10)
      resize.onEnd()
      expect(mock.set).toHaveBeenCalledExactlyOnceWith(
        route === 'code'
          ? 'code.layout.inspectorWidth'
          : 'notes.layout.inspectorWidth',
        width - 10,
      )
    }
  },
)
