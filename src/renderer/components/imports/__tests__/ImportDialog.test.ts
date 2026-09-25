import { createImportResultSession } from '@/composables/importResult'
import { beforeEach, expect, it, vi } from 'vitest'
import {
  computed,
  createRenderer,
  defineComponent,
  nextTick,
  ref,
  ssrContextKey,
  toRaw,
  watch,
} from 'vue'
import ImportDialog from '../ImportDialog.vue'

Object.assign(globalThis, { computed, ref, watch, toRaw })
const mocks = vi.hoisted(() => ({
  dialog: {} as any,
  apply: vi.fn(),
  refresh: vi.fn(),
  sonner: vi.fn(),
}))
vi.mock('@/composables', () => ({
  useImportDialog: () => mocks.dialog,
  useSonner: () => ({ sonner: mocks.sonner }),
  markPersistedStorageMutation: vi.fn(),
  useFolders: () => ({ getFolders: mocks.refresh }),
  useSnippets: () => ({ getSnippets: mocks.refresh }),
  useTags: () => ({ getTags: mocks.refresh }),
  useNoteFolders: () => ({ getNoteFolders: mocks.refresh }),
  useNotes: () => ({ getNotes: mocks.refresh }),
  useNoteTags: () => ({ getNoteTags: mocks.refresh }),
}))
vi.mock('@/services/api', () => ({
  api: { imports: { postImportsApply: mocks.apply } },
}))
vi.mock('@/router', () => ({ router: { push: vi.fn() }, RouterName: {} }))
vi.mock('@/electron', async () => {
  const { default: english } = await import(
    '~/main/i18n/locales/en_US/ui.json'
  )
  return {
    ipc: { invoke: vi.fn() },
    i18n: {
      t: (key: string, details: Record<string, string> = {}) => {
        const value = key
          .split('.')
          .reduce<any>((node, part) => node?.[part], english)
        return typeof value === 'string'
          ? value.replace(/\{\{(\w+)\}\}/g, (_, name) => details[name] ?? '')
          : key
      },
    },
  }
})
vi.mock('@/components/ui/shadcn/alert', () => ({}))
vi.mock('@/components/ui/shadcn/button', () => ({ Button: {} }))
vi.mock('@/components/ui/shadcn/dialog', () => ({}))
vi.mock('@/components/ui/shadcn/input', () => ({ Input: {} }))

beforeEach(() => vi.clearAllMocks())
function mount(space = 'code') {
  const session = createImportResultSession()
  const report = vi.fn()
  session.open(report)
  mocks.dialog = {
    importDialogSource: ref('auto'),
    importDialogSpace: ref(space),
    isImportDialogOpen: ref(true),
    importDialogOpening: ref(1),
    captureImportResult: session.capture,
    beginImportApply: session.beginApply,
    canContinueImport: session.canContinue,
    closeImportResult: session.close,
  }
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
  let bindings: any
  const app = renderer.createApp(
    defineComponent({
      setup() {
        bindings = ImportDialog.setup!({} as never, { expose() {} } as never)
        return () => null
      },
    }),
  )
  app.provide(ssrContextKey, {})
  app.mount({})
  bindings.preview.value = {
    source: space === 'notes' ? 'obsidian' : 'vscode',
    snippets: space === 'code' ? 1 : 0,
    notes: space === 'notes' ? 1 : 0,
    warnings: [],
  }
  return { app, bindings, report, session }
}

it.each([
  [
    'code',
    [{ code: 'vscode.invalidBody', source: 'javascript.json' }],
    [
      {
        source: 'javascript.json',
        message: 'Snippet body must be a string or string array.',
      },
    ],
  ],
  [
    'notes',
    [
      { code: 'obsidian.attachmentsKept', source: 'note.md' },
      {
        code: 'obsidian.frontmatterIgnored',
        source: 'note.md',
        details: { fields: ['custom', 'aliases'] },
      },
    ],
    [
      {
        source: 'note.md',
        message:
          'Attachment references are kept as text; attachment files are not imported.',
      },
      {
        source: 'note.md',
        message: 'Frontmatter fields ignored: custom,aliases.',
      },
    ],
  ],
  ['code', [], []],
] as const)(
  'delivers actual %s Apply warnings alongside counts',
  async (space, warnings, items) => {
    const { app, bindings, report } = mount(space)
    mocks.apply.mockResolvedValue({
      data: {
        source: space === 'notes' ? 'obsidian' : 'vscode',
        snippets: 1,
        warnings,
      },
    })
    try {
      await bindings.applyImport()
      expect(report).toHaveBeenCalledExactlyOnceWith(
        'applied',
        { snippets: 1 },
        { items, count: items.length, truncated: false },
      )
    }
    finally {
      app.unmount()
    }
  },
)

it('retains captured file/folder read warnings for the original Apply when its dialog is replaced', async () => {
  const { app, bindings, report, session } = mount('notes')
  bindings.fileReadWarnings.value = [
    { code: 'file.readFailed', source: 'old/unreadable.md' },
    { code: 'fs.folderReadFailed', source: 'old/locked' },
  ]
  let complete!: (data: any) => void
  mocks.apply.mockImplementation(
    () => new Promise(resolve => (complete = resolve)),
  )
  try {
    const pending = bindings.applyImport()
    await bindings.applyImport()
    expect(mocks.apply).toHaveBeenCalledTimes(1)
    session.close()
    const nextReport = vi.fn()
    session.open(nextReport)
    mocks.dialog.importDialogOpening.value++
    await nextTick()
    bindings.fileReadWarnings.value = [
      { code: 'file.readFailed', source: 'new/unreadable.md' },
    ]
    complete({
      data: {
        source: 'obsidian',
        notes: 1,
        warnings: [{ code: 'obsidian.attachmentsKept', source: 'old/note.md' }],
      },
    })
    await pending
    expect(report).toHaveBeenCalledExactlyOnceWith(
      'applied',
      { notes: 1 },
      {
        items: [
          {
            source: 'old/unreadable.md',
            message:
              'File could not be read. Make sure it is downloaded locally and available to massCode.',
          },
          {
            source: 'old/locked',
            message:
              'Folder could not be read. Check file permissions and iCloud download status.',
          },
          {
            source: 'old/note.md',
            message:
              'Attachment references are kept as text; attachment files are not imported.',
          },
        ],
        count: 3,
        truncated: false,
      },
    )
    expect(nextReport).not.toHaveBeenCalled()
    expect(bindings.fileReadWarnings.value[0].source).toBe('new/unreadable.md')
    expect(mocks.refresh).not.toHaveBeenCalled()
  }
  finally {
    app.unmount()
  }
})
