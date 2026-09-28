import type { HttpSnippetPayload } from '../../../shared/httpPreview'
import { ipcMain } from 'electron'
import { generateHttpSnippet } from '../../http/preview'

export function registerHttpPreviewHandlers() {
  ipcMain.handle(
    'spaces:http:generate-code',
    (_, payload: HttpSnippetPayload) => generateHttpSnippet(payload),
  )
}
