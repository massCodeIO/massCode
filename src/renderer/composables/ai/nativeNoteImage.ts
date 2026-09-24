import type { DrawingItem } from '@/composables/spaces/drawings/useDrawings'
import type { AiContext } from './useAi'
import type {
  NoteImagePickerInput,
  NoteImagePickerResult,
} from '~/main/types/ipc'
import type { AiNativeAction } from '~/shared/aiNativeActions'
import { ipc, store } from '@/electron'
import { nativeEditorMutation } from './taskUndo'
import { useAi } from './useAi'

export async function readNativeDrawings(
  action: Extract<AiNativeAction, { action: 'readDrawings' }>,
  current: () => boolean,
) {
  const vault = store.preferences.get('storage.vaultPath')
  const drawings = await ipc.invoke<null, DrawingItem[]>(
    'spaces:drawings:list',
    null,
  )
  if (!current() || vault !== store.preferences.get('storage.vaultPath'))
    return { status: 'stale' as const }
  const found = drawings.filter(item =>
    item.name.toLocaleLowerCase().includes(action.query.toLocaleLowerCase()),
  )
  return {
    status: 'done' as const,
    drawings: found
      .slice(action.offset, action.offset + 100)
      .map(({ id, name }) => ({ id, name })),
    total: found.length,
  }
}

export async function insertNativeNoteImage(
  action: Extract<
    AiNativeAction,
    { action: 'insertNoteImage' | 'insertDrawing' }
  >,
  current: () => boolean,
  editor: () => AiContext | undefined,
) {
  const before = editor()
  if (
    !current()
    || before?.space !== 'notes'
    || before.noteId !== action.target.id
  ) {
    return { status: 'stale' as const }
  }
  let position = action.location.kind === 'start' ? 0 : before.text.length
  if (action.location.kind === 'afterText') {
    const from = before.text.indexOf(action.location.text)
    if (from < 0 || before.text.includes(action.location.text, from + 1))
      return { status: 'unavailable' as const }
    position = from + action.location.text.length
  }
  const vault = store.preferences.get<string>('storage.vaultPath') ?? ''
  let picked: NoteImagePickerResult
  if (action.action === 'insertDrawing') {
    const drawings = await ipc.invoke<null, DrawingItem[]>(
      'spaces:drawings:list',
      null,
    )
    if (!drawings.some(item => item.id === action.drawingId))
      return { status: 'unavailable' as const }
    const content = await ipc.invoke('spaces:drawings:read', {
      id: action.drawingId,
    })
    if (typeof content !== 'string')
      return { status: 'unavailable' as const }
    picked = {
      status: 'saved',
      url: `masscode://drawing/${encodeURIComponent(action.drawingId)}`,
      bytes: 0,
    }
  }
  else {
    picked = await ipc.invoke<NoteImagePickerInput, NoteImagePickerResult>(
      'fs:pick-note-image',
      { vault, ...(action.source ? { source: action.source } : {}) },
    )
  }
  if (picked.status !== 'saved')
    return picked
  const after = editor()
  if (
    !current()
    || vault !== (store.preferences.get<string>('storage.vaultPath') ?? '')
    || after?.space !== 'notes'
    || after.noteId !== before.noteId
    || after.text !== before.text
  ) {
    return { status: 'stale' as const }
  }
  const alt = action.alt.replace(/[[\]\\\r\n]/g, ' ')
  const text = `${before.text.slice(0, position)}\n![${alt}](${picked.url})\n${before.text.slice(position)}`
  const mutation = nativeEditorMutation(before, text, vault)!
  try {
    const written = await useAi().writeNativeEditor(mutation.snapshot, text)
    return written
      ? { status: 'done' as const, persisted: true, mutation }
      : { status: 'stale' as const }
  }
  catch {
    return { status: 'failed' as const, persisted: false, mutation }
  }
}

export async function openNativeDrawingEmbed(
  action: Extract<AiNativeAction, { action: 'openDrawingEmbed' }>,
  current: () => boolean,
  editor: () => AiContext | undefined,
) {
  const before = editor()
  const vault = store.preferences.get('storage.vaultPath')
  if (
    !current()
    || before?.space !== 'notes'
    || before.noteId !== action.target.id
  ) {
    return { status: 'stale' as const }
  }
  const { getDrawingUrlsFromMarkdown } = await import(
    '~/shared/notes/drawingExport'
  )
  const embedded = getDrawingUrlsFromMarkdown(before.text).some((url) => {
    try {
      return (
        decodeURIComponent(url.slice('masscode://drawing/'.length))
        === action.drawingId
      )
    }
    catch {
      return false
    }
  })
  if (!embedded)
    return { status: 'unavailable' as const }
  const drawings = await ipc.invoke<null, DrawingItem[]>(
    'spaces:drawings:list',
    null,
  )
  const after = editor()
  if (
    !current()
    || vault !== store.preferences.get('storage.vaultPath')
    || after?.space !== 'notes'
    || after.noteId !== before.noteId
    || after.text !== before.text
  ) {
    return { status: 'stale' as const }
  }
  if (!drawings.some(item => item.id === action.drawingId))
    return { status: 'unavailable' as const }
  const { openDrawingTarget } = await import('@/ipc/listeners/deepLinks')
  const { useDrawings } = await import(
    '@/composables/spaces/drawings/useDrawings'
  )
  const { router, RouterName } = await import('@/router')
  await openDrawingTarget(action.drawingId)
  if (!current() || vault !== store.preferences.get('storage.vaultPath'))
    return { status: 'stale' as const }
  return {
    status:
      router.currentRoute.value.name === RouterName.drawingsSpace
      && useDrawings().activeDrawingId.value === action.drawingId
        ? ('done' as const)
        : ('cancelled' as const),
  }
}
