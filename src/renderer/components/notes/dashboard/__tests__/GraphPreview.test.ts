import type { NotesDashboardResponse } from '@/services/api/generated'
import { renderToString } from '@vue/server-renderer'
import { afterEach, expect, it, vi } from 'vitest'
import { computed, createSSRApp, defineComponent, h, ref } from 'vue'
import GraphPreview from '../GraphPreview.vue'

vi.mock('@/composables', () => ({
  useNotesDashboard: () => ({ navigateToGraph: vi.fn() }),
  useNotesWorkspaceNavigation: () => ({ openNoteInNotesWorkspace: vi.fn() }),
  useTheme: () => ({ isDark: ref(true) }),
}))
vi.mock('@/electron', () => ({ i18n: { t: (key: string) => key } }))
vi.mock('@vueuse/core', () => ({
  useElementSize: () => ({ width: ref(320), height: ref(256) }),
}))

afterEach(() => vi.unstubAllGlobals())

it('passes every note and edge to the mini graph, including isolated notes', async () => {
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('computed', computed)
  const graphPreview: NotesDashboardResponse['graphPreview'] = {
    nodes: Array.from({ length: 40 }, (_, index) => ({
      id: index + 1,
      name: `Note ${index + 1}`,
      folderId: null,
      incomingLinksCount: 0,
    })),
    edges: [
      { source: 1, target: 2 },
      { source: 25, target: 39 },
    ],
  }
  const capture = vi.fn()
  const app = createSSRApp(GraphPreview, { graphPreview })
  app.component(
    'UiText',
    defineComponent({
      setup:
        (_, { slots }) =>
          () =>
            h('span', slots.default?.()),
    }),
  )
  app.component(
    'UiEmptyPlaceholder',
    defineComponent({
      setup: () => () => h('span'),
    }),
  )
  app.component(
    'NotesGraphScene',
    defineComponent({
      props: ['nodes', 'edges'],
      setup(props) {
        capture(props.nodes, props.edges)
        return () => h('svg')
      },
    }),
  )
  await renderToString(app)
  expect(capture).toHaveBeenCalledWith(graphPreview.nodes, graphPreview.edges)
})
