import { i18n, ipc, store } from '@/electron'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
} from '@codemirror/view'
import {
  forgetImageUpload,
  imageUploadRanges,
  trackImageUpload,
} from './imageUploadRange'

const liveViews = new WeakSet<EditorView>()

function getImageExtension(file: File): string | null {
  const ext = file.name.includes('.')
    ? `.${file.name.split('.').pop()?.toLowerCase()}`
    : ''
  if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
    return ext
  }

  const mimeToExt: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
  }
  return mimeToExt[file.type] ?? null
}

async function insertImage(
  view: EditorView,
  file: File,
  pos: number,
  noteId: () => number | undefined,
) {
  const id = crypto.randomUUID()
  const vault = store.preferences.get<string>('storage.vaultPath') ?? ''
  const target = noteId()
  view.dispatch({ effects: trackImageUpload.of({ id, from: pos, text: '' }) })
  function finish(markdown: string) {
    if (
      !liveViews.has(view)
      || noteId() !== target
      || vault !== (store.preferences.get<string>('storage.vaultPath') ?? '')
    ) {
      return
    }
    const range = view.state.field(imageUploadRanges, false)?.get(id)
    if (!range)
      return
    view.dispatch({
      changes: { from: range.from, to: range.to, insert: markdown },
      effects: forgetImageUpload.of(id),
    })
  }
  try {
    const arrayBuffer = await file.arrayBuffer()
    const ext = getImageExtension(file)
    if (!ext)
      throw new TypeError('Unsupported Notes image type')
    if (
      !liveViews.has(view)
      || noteId() !== target
      || !view.state.field(imageUploadRanges, false)?.has(id)
      || vault !== (store.preferences.get<string>('storage.vaultPath') ?? '')
    ) {
      return
    }
    const url: string = await ipc.invoke('fs:notes-asset', {
      buffer: arrayBuffer,
      ext,
      vault,
    })
    if (vault !== (store.preferences.get<string>('storage.vaultPath') ?? ''))
      return
    const alt = file.name.replace(/\.[^.]+$/, '').replace(/[[\]\\\r\n]/g, ' ')
    finish(`![${alt}](${url})`)
  }
  catch (error) {
    console.error('[notes] Failed to save image', error)
    finish('')
  }
}

function getImageFile(dataTransfer: DataTransfer | null): File | null {
  if (!dataTransfer)
    return null
  for (const file of Array.from(dataTransfer.files)) {
    if (getImageExtension(file))
      return file
  }
  return null
}

class UploadWidget extends WidgetType {
  toDOM() {
    const element = document.createElement('span')
    element.textContent = i18n.t('spaces.notes.imageUploading')
    element.className = 'text-muted-foreground text-xs'
    return element
  }
}
export function createImageInsert(noteId: () => number | undefined) {
  return [
    imageUploadRanges,
    ViewPlugin.define((view) => {
      liveViews.add(view)
      return { destroy: () => liveViews.delete(view) }
    }),
    EditorView.decorations.compute([imageUploadRanges], state =>
      Decoration.set(
        [...state.field(imageUploadRanges).values()].map(range =>
          Decoration.widget({ widget: new UploadWidget(), side: 1 }).range(
            range.from,
          ),
        ),
        true,
      )),
    EditorView.domEventHandlers({
      paste(event, view) {
        const file = getImageFile(event.clipboardData)
        if (!file)
          return false

        // В буфере есть и текст — текстовая вставка приоритетнее: Excel кладёт
        // рядом с TSV ещё и картинку-рендер скопированных ячеек.
        if (event.clipboardData?.getData('text/plain'))
          return false

        event.preventDefault()
        const pos = view.state.selection.main.head
        void insertImage(view, file, pos, noteId)
        return true
      },

      drop(event, view) {
        const file = getImageFile(event.dataTransfer)
        if (!file)
          return false

        event.preventDefault()
        const pos
          = view.posAtCoords({ x: event.clientX, y: event.clientY })
            ?? view.state.selection.main.head
        void insertImage(view, file, pos, noteId)
        return true
      },
    }),
  ]
}
