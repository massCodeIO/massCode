import { nativeEditorMutation } from '@/composables/ai/taskUndo'
import { renderToString } from '@vue/server-renderer'
import { expect, it, vi } from 'vitest'
import {
  computed,
  createSSRApp,
  defineComponent,
  h,
  onMounted,
  ref,
} from 'vue'
import Panel from '../Panel.vue'
import TaskUndo from '../TaskUndo.vue'

Object.assign(globalThis, { computed, ref, onMounted })
const state = vi.hoisted(() => ({
  messages: [] as Record<string, unknown>[],
  undoTask: vi.fn(),
}))
vi.mock('@/composables/ai/useAi', () => ({
  useAi: () => ({
    conversation: ref({ messages: state.messages, error: 'provider' }),
    settings: ref({
      provider: 'openai',
      profiles: { openai: { model: 'test', hasKey: true } },
    }),
    isStreaming: ref(false),
    // An effect receipt forbids retry; footer availability must not rely on Retry.
    canRetry: () => false,
    undoTask: state.undoTask,
    refreshSettings: () => Promise.resolve(),
  }),
}))
vi.mock('@/composables/useCopyToClipboard', () => ({
  useCopyToClipboard: () => vi.fn(),
}))
vi.mock('@/composables/useDateFormat', () => ({
  useDateFormat: () => ({ formatDateTime: () => '' }),
}))
vi.mock('@/electron', () => ({ i18n: { t: (key: string) => key } }))
vi.mock('@/router', () => ({ router: { push: vi.fn() }, RouterName: {} }))
vi.mock('@vueuse/core', () => ({ useResizeObserver: vi.fn() }))
vi.mock('@/components/ui/shadcn/button', () => ({
  Button: defineComponent({
    setup:
      (_, { attrs, slots }) =>
        () =>
          h('button', attrs, slots.default?.()),
  }),
}))

async function render(message: Record<string, unknown>) {
  state.messages = [{ role: 'user', content: 'Edit note' }, message]
  const app = createSSRApp(Panel, { embedded: true })
  const empty = defineComponent({ render: () => null })
  for (const name of [
    'AiTaskStatus',
    'AiNativeActionReview',
    'AiSearchResults',
    'AiCreationResult',
    'AiMessage',
    'AiHttpChecks',
    'AiWorkspaceReview',
    'AiHttpActionReview',
    'AiHttpReview',
    'AiEditReview',
    'AiComposer',
  ])
    app.component(name, empty)
  app.component('AiTaskUndo', TaskUndo)
  for (const name of ['UiText', 'UiActionButton']) {
    app.component(
      name,
      defineComponent({
        setup:
          (_, { slots }) =>
            () =>
              h('span', slots.default?.()),
      }),
    )
  }
  return renderToString(app)
}

it.each(['error', 'cancelled'])(
  'shows actual Task Undo after %s without final prose when native edits were recorded',
  async (status) => {
    const html = await render({
      role: 'assistant',
      content: '',
      status,
      nativeActions: [
        {
          id: 'format',
          status: 'done',
          operation: { action: 'editorCommand', command: 'bold' },
        },
      ],
      taskMutations: [
        nativeEditorMutation(
          { space: 'notes', noteId: 1129, text: 'alpha' },
          '**alpha**',
          '/vault',
        ),
      ],
    })
    expect(html).toMatch(
      /<button(?![^>]*disabled)[^>]*>ai.task.undo<\/button>/,
    )
    expect(html).not.toContain('ai.retry')
  },
)

it('keeps Undo visible from recorded mutations even if native action cards are absent', async () => {
  expect(
    await render({
      role: 'assistant',
      content: '',
      status: 'error',
      taskMutations: [{ kind: 'editor', undone: false }],
    }),
  ).toContain('ai.task.undo')
})

it.each([undefined, [], [{ kind: 'editor', undone: true }]])(
  'does not offer Undo for read-only or already undone actions (%j)',
  async (taskMutations) => {
    const html = await render({
      role: 'assistant',
      content: '',
      status: 'cancelled',
      nativeActions: [{ id: 'read', status: 'done' }],
      taskMutations,
    })
    expect(html).not.toContain('ai.task.undo')
  },
)
