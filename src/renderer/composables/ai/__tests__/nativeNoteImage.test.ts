import { beforeEach, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({
  vault: '/vault',
  picker: vi.fn(),
  writer: vi.fn(),
  mutation: vi.fn(),
  route: { value: { name: 'notes' } },
  drawing: { value: null as string | null },
  openDrawing: vi.fn(),
}))
vi.mock('@/electron', () => ({
  ipc: { invoke: mock.picker },
  store: { preferences: { get: () => mock.vault } },
}))
vi.mock('@/router', () => ({
  router: { currentRoute: mock.route },
  RouterName: { drawingsSpace: 'drawings' },
}))
vi.mock('@/ipc/listeners/deepLinks', () => ({
  openDrawingTarget: mock.openDrawing,
}))
vi.mock('@/composables/spaces/drawings/useDrawings', () => ({
  useDrawings: () => ({ activeDrawingId: mock.drawing }),
}))
vi.mock('../useAi', () => ({
  useAi: () => ({ writeNativeEditor: mock.writer }),
}))
vi.mock('../taskUndo', () => ({ nativeEditorMutation: mock.mutation }))
const { insertNativeNoteImage, readNativeDrawings, openNativeDrawingEmbed }
  = await import('../nativeNoteImage')
const action = {
  action: 'insertNoteImage' as const,
  target: { space: 'notes' as const, id: 1 },
  alt: 'Example',
  location: { kind: 'end' as const },
}
const context = {
  space: 'notes' as const,
  noteId: 1,
  text: 'Existing',
  selection: '',
  language: 'markdown',
}
beforeEach(() => {
  vi.resetAllMocks()
  mock.vault = '/vault'
  mock.picker.mockResolvedValue({
    status: 'saved',
    url: 'masscode-asset://notes/image.png',
    bytes: 3,
  })
  mock.writer.mockResolvedValue(true)
  mock.mutation.mockImplementation((before, text) => ({
    snapshot: before,
    text,
  }))
})
it('does not insert when the picker was cancelled', async () => {
  mock.picker.mockResolvedValue({ status: 'cancelled' })
  expect(
    await insertNativeNoteImage(
      action,
      () => true,
      () => context,
    ),
  ).toEqual({ status: 'cancelled' })
  expect(mock.writer).not.toHaveBeenCalled()
})
it('does not overwrite manual edits, another note or another vault after choosing an image', async () => {
  for (const change of ['text', 'note', 'vault']) {
    let current = { ...context }
    mock.picker.mockImplementationOnce(async () => {
      if (change === 'text')
        current = { ...current, text: 'Manual edit' }
      if (change === 'note')
        current = { ...current, noteId: 2 }
      if (change === 'vault')
        mock.vault = '/other'
      return {
        status: 'saved',
        url: 'masscode-asset://notes/image.png',
        bytes: 3,
      }
    })
    expect(
      await insertNativeNoteImage(
        action,
        () => true,
        () => current,
      ),
    ).toEqual({ status: 'stale' })
    mock.vault = '/vault'
  }
  expect(mock.writer).not.toHaveBeenCalled()
})
it('returns a reversible receipt for a persisted edit and retains it after a save failure', async () => {
  const text = 'Existing\n![Example](masscode-asset://notes/image.png)\n'
  expect(
    await insertNativeNoteImage(
      action,
      () => true,
      () => context,
    ),
  ).toMatchObject({ status: 'done', persisted: true })
  expect(mock.writer).toHaveBeenCalledWith(context, text)
  mock.writer.mockRejectedValue(new Error('disk full'))
  expect(
    await insertNativeNoteImage(
      action,
      () => true,
      () => context,
    ),
  ).toMatchObject({ status: 'failed', persisted: false, mutation: { text } })
})
it('lists only drawing names and IDs with bounded pagination', async () => {
  mock.picker.mockResolvedValue(
    Array.from({ length: 105 }, (_, i) => ({
      id: `drawing-${i}`,
      name: `Architecture ${i}`,
      content: 'not exposed',
    })),
  )
  const result = await readNativeDrawings(
    { action: 'readDrawings', query: 'architecture', offset: 100 },
    () => true,
  )
  expect(result).toMatchObject({ status: 'done', total: 105 })
  expect(result.drawings).toHaveLength(5)
  expect(result.drawings?.[0]).toEqual({
    id: 'drawing-100',
    name: 'Architecture 100',
  })
})
it('embeds only an existing readable drawing and never invokes a file picker', async () => {
  const drawingAction = {
    ...action,
    action: 'insertDrawing' as const,
    drawingId: 'Architecture diagram',
  }
  mock.picker.mockResolvedValueOnce([])
  expect(
    await insertNativeNoteImage(
      drawingAction,
      () => true,
      () => context,
    ),
  ).toEqual({ status: 'unavailable' })
  expect(mock.writer).not.toHaveBeenCalled()
  mock.picker
    .mockResolvedValueOnce([
      { id: drawingAction.drawingId, name: 'Architecture' },
    ])
    .mockResolvedValueOnce('{}')
  expect(
    await insertNativeNoteImage(
      drawingAction,
      () => true,
      () => context,
    ),
  ).toMatchObject({ status: 'done', persisted: true })
  expect(mock.writer.mock.calls[0]![1]).toContain(
    'masscode://drawing/Architecture%20diagram',
  )
  expect(
    mock.picker.mock.calls.every(([channel]) =>
      channel.startsWith('spaces:drawings:'),
    ),
  ).toBe(true)
})

it('opens only actual embeds and verifies the drawing route after leaving the source note', async () => {
  const operation = {
    action: 'openDrawingEmbed' as const,
    target: { space: 'notes' as const, id: 1 },
    drawingId: 'one',
  }
  mock.picker.mockResolvedValue([{ id: 'one', name: 'One' }])
  expect(
    await openNativeDrawingEmbed(
      operation,
      () => true,
      () => ({ ...context, text: '`![code](masscode://drawing/one)`' }),
    ),
  ).toEqual({ status: 'unavailable' })
  let source: typeof context | undefined = {
    ...context,
    text: '![drawing](masscode://drawing/one)',
  }
  mock.openDrawing.mockImplementation(async () => {
    mock.route.value.name = 'drawings'
    mock.drawing.value = 'one'
    source = undefined
  })
  expect(
    await openNativeDrawingEmbed(
      operation,
      () => true,
      () => source,
    ),
  ).toEqual({ status: 'done' })
  expect(mock.openDrawing).toHaveBeenCalledWith('one')
})

it('uses image-only clipboard capture with the existing persistence and Undo receipt', async () => {
  const result = await insertNativeNoteImage(
    { ...action, source: 'clipboardImage' },
    () => true,
    () => context,
  )
  expect(mock.picker).toHaveBeenCalledWith('fs:pick-note-image', {
    vault: '/vault',
    source: 'clipboardImage',
  })
  expect(result).toMatchObject({
    status: 'done',
    persisted: true,
    mutation: {
      text: 'Existing\n![Example](masscode-asset://notes/image.png)\n',
    },
  })
  mock.picker.mockResolvedValueOnce({ status: 'failed' })
  mock.writer.mockClear()
  expect(
    await insertNativeNoteImage(
      { ...action, source: 'clipboardImage' },
      () => true,
      () => context,
    ),
  ).toEqual({ status: 'failed' })
  expect(mock.writer).not.toHaveBeenCalled()
})
