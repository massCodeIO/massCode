import type { EditorSettings } from '../../store/types'
import type { PrettierOptions } from '../../types/ipc'
import { ipcMain } from 'electron'
import prettier from 'prettier'
import { store } from '../../store'

export async function format(source: string, parser: string) {
  const editor = store.preferences.get('editor.code') as EditorSettings

  return prettier.format(source, {
    parser,
    tabWidth: Number(editor.tabSize),
    trailingComma: editor.trailingComma,
    semi: editor.semi,
    singleQuote: editor.singleQuote,
  })
}

export function registerPrettierHandlers() {
  ipcMain.handle<PrettierOptions>('prettier:format', (event, payload) => {
    const { text, parser } = payload
    return format(text, parser)
  })
}
