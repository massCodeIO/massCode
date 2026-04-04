import type { EditorSettings } from '~/main/store/types'

export function getJsonDiffFontVariables(
  settings: Pick<EditorSettings, 'fontSize' | 'fontFamily'>,
) {
  return {
    '--json-diff-font-size': `${settings.fontSize}px`,
    '--json-diff-font-family': settings.fontFamily,
    '--json-diff-line-height': '1.54',
  }
}
