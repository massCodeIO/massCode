import { ipc } from '@/electron'
import { EditorView } from '@codemirror/view'

function getImageExtension(file: File): string {
  const ext = file.name.includes('.') ? `.${file.name.split('.').pop()}` : ''
  if (ext)
    return ext

  const mimeToExt: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
    'image/bmp': '.bmp',
  }
  return mimeToExt[file.type] || '.png'
}

async function insertImage(view: EditorView, file: File, pos: number) {
  const placeholder = '![Uploading...]()'
  view.dispatch({
    changes: { from: pos, insert: placeholder },
  })

  try {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Array.from(new Uint8Array(arrayBuffer))
    const ext = getImageExtension(file)
    const url: string = await ipc.invoke('fs:notes-asset', { buffer, ext })
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
    if (file.type.startsWith('image/'))
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
