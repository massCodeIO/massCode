import { expect, it, vi } from 'vitest'
import {
  createRenderer,
  defineComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  onUnmounted,
  ref,
  ssrContextKey,
  watch,
} from 'vue'

const mocks = vi.hoisted(() => ({
  save: vi.fn(async () => ({ status: 'saved' })),
  setData: vi.fn(async () => {}),
  fit: vi.fn(async () => {}),
  notes: undefined as any,
  control: undefined as any,
  rescale: vi.fn(async (_scale: number) => {}),
}))
vi.mock('@/composables', () => ({ useNotes: () => mocks.notes }))
vi.mock('@/composables/ai/nativeBridges', () => ({
  useNativeExportBridge(_view: string, _save: unknown, control: unknown) {
    mocks.control = control
  },
}))
vi.mock('@/composables/useRenderedArtifactExport', () => ({
  saveRenderedArtifact: mocks.save,
}))
vi.mock('@/electron', () => ({ i18n: { t: (key: string) => key } }))
vi.mock('markmap-lib', () => ({
  Transformer: class {
    transform(value: string) {
      return { root: value }
    }
  },
}))
vi.mock('markmap-view', () => ({
  Markmap: {
    create: () => ({
      setData: mocks.setData,
      fit: mocks.fit,
      rescale: mocks.rescale,
      destroy() {},
    }),
  },
}))
vi.mock('dom-to-image', () => ({ default: {} }))

it('does not export map A under loading note B and waits for B to finish rendering', async () => {
  mocks.notes = {
    selectedNote: ref({ id: 1, name: 'A', content: '# A' } as {
      id: number
      name: string
      content?: string
    }),
    selectedNoteRecordStatus: ref('ready'),
  }
  Object.entries({
    ref,
    watch,
    onMounted,
    onUnmounted,
    onBeforeUnmount,
    useTemplateRef: () => ref({ addEventListener() {} }),
  }).forEach(([key, value]) => vi.stubGlobal(key, value))
  const component = (await import('../NotesMindmap.vue')).default
  let state: any
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
  const app = renderer.createApp(
    defineComponent({
      setup() {
        state = (component as any).setup({}, { expose() {} })
        return () => null
      },
    }),
  )
  app.provide(ssrContextKey, {})
  try {
    app.mount({})
    await vi.waitFor(() => expect(mocks.fit).toHaveBeenCalledOnce())
    mocks.notes.selectedNote.value = { id: 2, name: 'B' }
    mocks.notes.selectedNoteRecordStatus.value = 'loading'
    await nextTick()
    expect(await state.onSaveScreenshot('svg')).toEqual({ status: 'stale' })
    expect(
      await mocks.control(
        {
          action: 'mindmap',
          target: { space: 'notes', id: 2 },
          command: 'zoomIn',
        },
        () => true,
      ),
    ).toEqual({ status: 'stale' })
    expect(mocks.rescale).not.toHaveBeenCalled()
    expect(mocks.save).not.toHaveBeenCalled()
    let finish!: () => void
    mocks.setData.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    mocks.notes.selectedNote.value = { id: 2, name: 'B', content: '# B' }
    mocks.notes.selectedNoteRecordStatus.value = 'ready'
    await nextTick()
    await vi.waitFor(() =>
      expect(mocks.setData).toHaveBeenLastCalledWith('# B'),
    )
    const control = mocks.control(
      {
        action: 'mindmap',
        target: { space: 'notes', id: 2 },
        command: 'zoomIn',
      },
      () => true,
    )
    const saving = state.onSaveScreenshot('svg')
    expect(mocks.save).not.toHaveBeenCalled()
    finish()
    await saving
    expect(await control).toMatchObject({ status: 'done' })
    expect(mocks.rescale).toHaveBeenCalledWith(1.25)
    expect(mocks.save).toHaveBeenCalledWith(
      'svg',
      'B',
      expect.any(Function),
      expect.any(Function),
    )
  }
  finally {
    app.unmount()
    vi.unstubAllGlobals()
  }
})
