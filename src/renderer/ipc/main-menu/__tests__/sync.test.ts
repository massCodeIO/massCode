import { expect, it, vi } from 'vitest'
import { reactive, ref, watch } from 'vue'

const mock = vi.hoisted(() => ({
  send: vi.fn(),
  snippets: {} as any,
  app: {} as any,
}))
Object.assign(globalThis, { watch })
vi.mock('@/electron', () => ({ ipc: { send: mock.send } }))
vi.mock('@/spaceDefinitions', () => ({ getActiveSpaceId: () => 'code' }))
vi.mock('@/composables', () => ({
  useApp: () => mock.app,
  useSnippets: () => mock.snippets,
  useNotes: () => ({ selectedNote: ref(undefined) }),
  useNotesApp: () => ({
    isNotesInspectorOpen: ref(false),
    isNotesMindmapShown: ref(false),
    isNotesPresentationShown: ref(false),
    notesEditorMode: ref('raw'),
    notesLayoutMode: ref('all-panels'),
    hideCompletedTasksInFolders: ref(false),
  }),
  useHttpApp: () => ({ httpLayoutMode: ref('all-panels'), httpState: {} }),
  useHttpExecute: () => ({ isExecuting: ref(false) }),
  useHttpRequests: () => ({
    currentDraft: ref(undefined),
    currentRequest: ref(undefined),
    isCurrentRequestLoading: ref(false),
  }),
  useContentSort: () => ({
    contentSortState: Object.fromEntries(
      ['code', 'notes', 'http', 'math', 'drawings'].map(space => [
        space,
        { sort: 'name', order: 'ASC' },
      ]),
    ),
  }),
}))
vi.mock('@/composables/spaces/http/useHttpPanels', () => ({
  useHttpPanels: () => ({ bottomOpen: ref(false), inspectorOpen: ref(false) }),
}))
it('synchronizes format availability for supported, loaded single-selection fragments only', async () => {
  mock.app = {
    state: reactive({ snippetId: 1 }),
    codeLayoutMode: ref('all-panels'),
    isCompactListMode: ref(false),
    isShowCodePreview: ref(false),
    isShowJsonVisualizer: ref(false),
  }
  mock.snippets = {
    isAvailableToCodePreview: ref(false),
    selectedSnippet: ref({ id: 1 }),
    selectedSnippetContent: ref({
      id: 2,
      language: 'javascript',
      value: '' as string | undefined,
    }),
    selectedSnippetIds: ref([1]),
    selectedSnippetRecordStatus: ref('ready'),
  }
  const { registerMainMenuContextSync } = await import('../sync')
  registerMainMenuContextSync()
  const enabled = () => mock.send.mock.calls.at(-1)![1].editor.canFormat
  expect(enabled()).toBe(true)
  mock.snippets.selectedSnippetContent.value.language = 'dockerfile'
  await vi.waitFor(() => expect(enabled()).toBe(false))
  mock.snippets.selectedSnippetContent.value.language = 'typescript'
  await vi.waitFor(() => expect(enabled()).toBe(true))
  mock.snippets.selectedSnippetRecordStatus.value = 'loading'
  await vi.waitFor(() => expect(enabled()).toBe(false))
  mock.snippets.selectedSnippetRecordStatus.value = 'ready'
  mock.snippets.selectedSnippetContent.value.value = undefined
  await vi.waitFor(() => expect(enabled()).toBe(false))
  mock.snippets.selectedSnippetContent.value.value = ''
  await vi.waitFor(() => expect(enabled()).toBe(true))
  mock.snippets.selectedSnippetIds.value = [1, 3]
  await vi.waitFor(() => expect(enabled()).toBe(false))
  mock.snippets.selectedSnippetIds.value = [1]
  mock.app.state.snippetId = 3
  await vi.waitFor(() => expect(enabled()).toBe(false))
})
