import { describe, expect, it } from 'vitest'
import {
  createNotesEditThemeStyles,
  type NotesEditorThemeSettings,
} from '../theme'

const settings: NotesEditorThemeSettings = {
  fontSize: 14,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  codeFontFamily: 'SF Mono, Consolas, Menlo, Ubuntu Mono, monospace',
  lineHeight: 1.54,
  limitWidth: true,
  lineNumbers: true,
  indentSize: 2,
}

describe('createNotesEditThemeStyles', () => {
  it('keeps gutter metrics aligned with content in raw mode', () => {
    const styles = createNotesEditThemeStyles(true, settings)

    expect(styles['.cm-content']).toEqual(
      expect.objectContaining({
        fontFamily: settings.fontFamily,
        lineHeight: String(settings.lineHeight),
        padding: '10px 20px 28px',
      }),
    )

    expect(styles['.cm-gutters']).toEqual(
      expect.objectContaining({
        fontFamily: settings.fontFamily,
        lineHeight: String(settings.lineHeight),
      }),
    )

    expect(styles['.cm-gutterElement']).toEqual(
      expect.objectContaining({
        fontFamily: settings.fontFamily,
        lineHeight: String(settings.lineHeight),
      }),
    )
  })

  it('hides gutters outside raw mode', () => {
    const styles = createNotesEditThemeStyles(false, settings)

    expect(styles['.cm-gutters']).toEqual(
      expect.objectContaining({
        display: 'none',
      }),
    )
  })
})
