import type { EditorSettings } from './types'

export const APP_DEFAULTS = {
  sizes: {
    sidebar: 180,
    snippetList: 250,
    tagsList: 50, // в %
  },
}

export const EDITOR_DEFAULTS: EditorSettings = {
  fontSize: 13,
  fontFamily: 'SF Mono, Consolas, Menlo, Ubuntu Mono, monospace',
  wrap: false,
  tabSize: 2,
  trailingComma: 'all',
  semi: false,
  singleQuote: false,
  highlightLine: false,
  matchBrackets: true,
}
