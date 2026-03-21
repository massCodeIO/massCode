import { EditorView } from '@codemirror/view'
import { notesEditorScrollbarTheme } from './cm-extensions/scrollbarTheme'

export interface NotesEditorThemeSettings {
  fontSize: number
  fontFamily: string
  codeFontFamily: string
  lineHeight: number
  limitWidth: boolean
  lineNumbers: boolean
  indentSize: number
}

const CONTENT_PADDING = '10px 20px 28px'
const RAW_CONTENT_PADDING = '10px 20px 28px 4px'
export function createNotesEditThemeStyles(
  raw: boolean,
  notesSettings: NotesEditorThemeSettings,
): Parameters<typeof EditorView.theme>[0] {
  return {
    '&': {
      'height': '100%',
      'fontSize': `${notesSettings.fontSize}px`,
      'backgroundColor': 'var(--background)',
      'color': 'var(--foreground)',
      '--notes-code-font': notesSettings.codeFontFamily,
    },
    '.cm-content': {
      fontFamily: notesSettings.fontFamily,
      padding: raw ? RAW_CONTENT_PADDING : CONTENT_PADDING,
      lineHeight: String(notesSettings.lineHeight),
      caretColor: 'var(--foreground)',
      ...(notesSettings.limitWidth
        ? { maxWidth: '700px', margin: '0 auto' }
        : {}),
    },
    '.cm-cursor': {
      borderLeftColor: 'var(--foreground)',
    },
    '.cm-selectionBackground': {
      backgroundColor: 'var(--accent) !important',
    },
    '&.cm-focused .cm-selectionBackground': {
      backgroundColor: 'var(--accent) !important',
    },
    '.cm-gutters': {
      backgroundColor: 'var(--background)',
      borderRight: 'none',
      color: 'var(--muted-foreground)',
      fontFamily: notesSettings.fontFamily,
      lineHeight: String(notesSettings.lineHeight),
      ...(notesSettings.lineNumbers && raw ? {} : { display: 'none' }),
    },
    ...notesEditorScrollbarTheme,
    '&.cm-focused': {
      outline: 'none',
    },
    '.cm-gutterElement': {
      fontFamily: notesSettings.fontFamily,
      lineHeight: String(notesSettings.lineHeight),
    },
    '.cm-lineNumbers .cm-gutterElement': {
      padding: '0 3px 0 5px',
      minWidth: '20px',
      textAlign: 'right',
      whiteSpace: 'nowrap',
    },
    '.cm-line': {
      padding: '0',
    },
  }
}

export function createNotesEditTheme(
  raw: boolean,
  notesSettings: NotesEditorThemeSettings,
) {
  return EditorView.theme(createNotesEditThemeStyles(raw, notesSettings))
}
