import prettier from 'prettier'
import { store } from '../../store'

export const format = (source: string, parser: string) => {
  const editor = store.preferences.get('editor')

  const formatted = prettier.format(source, {
    parser,
    tabWidth: editor.tabSize,
    trailingComma: editor.trailingComma,
    semi: editor.semi,
    singleQuote: editor.singleQuote
  })

  return formatted
}
