import type { EditorSettings, NotesEditorSettings } from './types'

export const LAYOUT_DEFAULTS = {
  sidebar: { width: 200, min: 120 },
  list: { width: 300, min: 150 },
  editor: { min: 300 },
  tags: { height: 200, min: 80 },
  http: {
    responsePanel: { height: 300, min: 120 },
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

export const NOTES_EDITOR_DEFAULTS: NotesEditorSettings = {
  fontSize: 14,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  codeFontFamily: 'SF Mono, Consolas, Menlo, Ubuntu Mono, monospace',
  lineHeight: 1.54,
  limitWidth: true,
  lineNumbers: false,
  indentSize: 2,
}
