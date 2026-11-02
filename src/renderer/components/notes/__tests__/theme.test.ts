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
  it('keeps raw content independent of the display width setting', () => {
    const limited = createNotesEditThemeStyles(true, settings)
    const unlimited = createNotesEditThemeStyles(true, {
      ...settings,
      limitWidth: false,
    })

    expect(limited['.cm-content']).toEqual(unlimited['.cm-content'])
    expect(limited['.cm-content']).not.toHaveProperty('maxWidth')
    expect(limited['.cm-content']).not.toHaveProperty('margin')
  })

  it('limits and centers formatted content only when enabled', () => {
    const limited = createNotesEditThemeStyles(false, settings)
    const unlimited = createNotesEditThemeStyles(false, {
      ...settings,
      limitWidth: false,
    })

    expect(limited['.cm-content']).toMatchObject({
      maxWidth: '700px',
      margin: '0 auto',
    })
    expect(unlimited['.cm-content']).not.toHaveProperty('maxWidth')
    expect(unlimited['.cm-content']).not.toHaveProperty('margin')
  })

  it('keeps gutter metrics aligned with content in raw mode', () => {
    const styles = createNotesEditThemeStyles(true, settings)

    expect(styles['.cm-content']).toEqual(
      expect.objectContaining({
        fontFamily: settings.fontFamily,
        lineHeight: String(settings.lineHeight),
        padding: '10px 20px 28px 4px',
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

    expect(styles['.cm-lineNumbers .cm-gutterElement']).toEqual({
      padding: '0 3px 0 5px',
      minWidth: 'calc(3ch + 8px)',
      textAlign: 'right',
      whiteSpace: 'nowrap',
    })
  })

  it('hides gutters outside raw mode', () => {
    const styles = createNotesEditThemeStyles(false, settings)

    expect(styles['.cm-content']).toEqual(
      expect.objectContaining({
        padding: '10px 20px 28px',
      }),
    )

    expect(styles['.cm-gutters']).toEqual(
      expect.objectContaining({
        display: 'none',
      }),
    )
  })
})
