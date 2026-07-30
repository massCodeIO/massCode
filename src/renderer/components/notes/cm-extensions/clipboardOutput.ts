import { EditorView } from '@codemirror/view'

export function createClipboardOutput(isWindows: boolean) {
  return EditorView.clipboardOutputFilter.of(text =>
    isWindows ? text.replace(/\r?\n/g, '\r\n') : text,
  )
}
