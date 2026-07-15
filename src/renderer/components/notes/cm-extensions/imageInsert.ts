import { ipc } from '@/electron'
import { EditorView } from '@codemirror/view'

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

async function insertImage(view: EditorView, file: File, pos: number) {
  const placeholder = '![Uploading...]()'
  view.dispatch({
    changes: { from: pos, insert: placeholder },
  })

  try {
    const arrayBuffer = await file.arrayBuffer()
    const ext = getImageExtension(file)
    if (!ext) {
      throw new TypeError('Unsupported Notes image type')
    }
    const url: string = await ipc.invoke('fs:notes-asset', {
      buffer: arrayBuffer,
      ext,
    })
    const alt = file.name.replace(/\.[^.]+$/, '') || 'image'
    const markdown = `![${alt}](${url})`

    view.dispatch({
      changes: { from: pos, to: pos + placeholder.length, insert: markdown },
    })
  }
  catch (error) {
    console.error('[notes] Failed to save image', error)
    view.dispatch({
      changes: { from: pos, to: pos + placeholder.length, insert: '' },
    })
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

export function createImageInsert() {
  return EditorView.domEventHandlers({
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
      void insertImage(view, file, pos)
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
      void insertImage(view, file, pos)
      return true
    },
  })
}
