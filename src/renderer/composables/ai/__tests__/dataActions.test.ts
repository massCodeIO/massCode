import { beforeEach, expect, it, vi } from 'vitest'
import { createImportResultSession } from '../../importResult'
import { executeDataAction } from '../dataActions'

const fixture = vi.hoisted(() => ({
  invoke: vi.fn(),
  note: vi.fn(),
  open: vi.fn(),
  httpOpen: vi.fn(),
  push: vi.fn(),
  exportWarning: vi.fn(),
}))
vi.mock('@/electron', () => ({ ipc: { invoke: fixture.invoke } }))
vi.mock('@/services/api', () => ({
  api: { notes: { getNotesById: fixture.note } },
}))
vi.mock('@/router', () => ({
  router: {
    push: fixture.push,
    currentRoute: { value: { name: 'http-space' } },
  },
  RouterName: { httpSpace: 'http-space' },
}))
vi.mock('@/components/notes/drawingExport', () => ({
  renderDrawingPreviews: async () => [],
  renderDrawingPreviewsFromMarkdown: async () => [],
}))
vi.mock('@/components/notes/exportWarnings', () => ({
  showNoteExportWarnings: fixture.exportWarning,
}))
vi.mock('@/composables/useContentSort', () => ({
  useContentSort: () => ({
    getContentSortQuery: () => ({ sort: 'name', order: 'ASC' }),
  }),
}))
vi.mock('@/composables/useImportDialog', () => ({
  useImportDialog: () => ({ openImportDialog: fixture.open }),
}))
vi.mock('@/composables/useHttpImportDialog', () => ({
  useHttpImportDialog: () => ({ openHttpImportDialog: fixture.httpOpen }),
}))
Object.assign(globalThis, { nextTick: async () => {} })
beforeEach(() => vi.clearAllMocks())
it('reports real export losses to the assistant after the native write completes', async () => {
  fixture.note.mockResolvedValue({
    data: { id: 7, name: 'Diagram', content: 'saved text' },
  })
  fixture.invoke.mockResolvedValue({
    canceled: false,
    filePath: '/tmp/report.html',
    warnings: { mermaid: 1, remoteImages: 2 },
  })
  const report = vi.fn()
  await executeDataAction(
    {
      id: 'export-loss',
      kind: 'export',
      status: 'pending',
      input: { kind: 'note', id: 7, format: 'html', source: 'saved' },
    },
    undefined,
    () => undefined,
    report,
    () => true,
  )
  expect(report.mock.calls.at(-1)).toEqual([
    'applied',
    { mermaidWarnings: 1, remoteImagesWarnings: 2 },
  ])
  expect(fixture.exportWarning).toHaveBeenCalledWith({
    mermaid: 1,
    remoteImages: 2,
  })
})
it('opens the existing import flow without claiming apply and waits for actual callbacks', async () => {
  const report = vi.fn()
  await executeDataAction(
    {
      id: '1',
      kind: 'import',
      status: 'pending',
      input: { space: 'notes', source: 'obsidian' },
    },
    undefined,
    () => undefined,
    report,
    () => true,
  )
  expect(report).toHaveBeenCalledExactlyOnceWith('opened')
  expect(fixture.open).toHaveBeenCalledWith(
    'obsidian',
    'notes',
    report,
    expect.any(Function),
  )
  const session = createImportResultSession()
  session.open(report)
  const first = session.capture()
  first('previewed', { notes: 2 })
  session.close()
  first('applied', { notes: 2 })
  expect(report).not.toHaveBeenCalledWith('applied', expect.anything())
  session.open(report)
  session.beginApply()!.report('applied', { notes: 2 })
  session.close()
  expect(report.mock.calls.at(-1)).toEqual(['applied', { notes: 2 }])
})
it.each([false, true])(
  'exports exact captured unsaved Notes text and reports actual cancel=%s',
  async (canceled) => {
    fixture.invoke.mockResolvedValue({ canceled })
    const report = vi.fn()
    const snapshot = {
      space: 'notes' as const,
      noteId: 7,
      text: 'Unsaved Markdown',
      language: 'markdown',
      selection: '',
      name: 'Note',
    }
    const action = {
      id: '2',
      kind: 'export' as const,
      status: 'pending' as const,
      input: {
        kind: 'note' as const,
        id: 7,
        format: 'html' as const,
        source: 'current' as const,
      },
    }
    await executeDataAction(
      action,
      snapshot,
      () => snapshot,
      report,
      () => true,
    )
    expect(fixture.note).not.toHaveBeenCalled()
    expect(fixture.invoke).toHaveBeenCalledWith(
      'fs:export-note',
      expect.objectContaining({
        content: 'Unsaved Markdown',
        name: 'Note',
        format: 'html',
      }),
    )
    expect(report.mock.calls.at(-1)).toEqual([
      canceled ? 'cancelled' : 'applied',
    ])
    fixture.invoke.mockClear()
    await expect(
      executeDataAction(
        action,
        snapshot,
        () => ({ ...snapshot, noteId: 8 }),
        report,
        () => true,
      ),
    ).rejects.toThrow('EDITOR_CHANGED')
    expect(fixture.invoke).not.toHaveBeenCalled()
  },
)
it('does not report a failed native save as completed or export across vault changes', async () => {
  fixture.note.mockResolvedValue({ data: { name: 'Saved', content: 'Body' } })
  fixture.invoke.mockRejectedValue(new Error('save failed'))
  const report = vi.fn()
  const action = {
    id: '3',
    kind: 'export' as const,
    status: 'pending' as const,
    input: {
      kind: 'note' as const,
      id: 7,
      format: 'pdf' as const,
      source: 'saved' as const,
    },
  }
  await expect(
    executeDataAction(
      action,
      undefined,
      () => undefined,
      report,
      () => true,
    ),
  ).rejects.toThrow('save failed')
  expect(report).not.toHaveBeenCalledWith('applied')
  fixture.invoke.mockClear()
  await executeDataAction(
    action,
    undefined,
    () => undefined,
    report,
    () => false,
  )
  expect(fixture.invoke).not.toHaveBeenCalled()
  expect(report).toHaveBeenLastCalledWith('cancelled')
})

it('opens the existing HTTP import dialog and invalidates an old-vault preview before Apply', async () => {
  const report = vi.fn()
  await executeDataAction(
    {
      id: 'http',
      kind: 'import',
      status: 'pending',
      input: { space: 'http', source: 'http-files' },
    },
    undefined,
    () => undefined,
    report,
    () => true,
  )
  expect(fixture.push).toHaveBeenCalledWith({ name: 'http-space' })
  expect(fixture.httpOpen).toHaveBeenCalledWith(report, expect.any(Function))
  expect(report).toHaveBeenCalledExactlyOnceWith('opened')
  let sameVault = true
  const session = createImportResultSession()
  session.open(report, () => sameVault)
  session.capture()('previewed')
  sameVault = false
  expect(session.canContinue()).toBe(false)
  expect(report).toHaveBeenLastCalledWith('cancelled')
})
