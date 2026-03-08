export type ThemeType = 'light' | 'dark'

export type ThemeColors = Record<string, string>

export type ThemeEditorColors = Record<string, string>

export interface ThemeFile {
  name: string
  author?: string
  type: ThemeType
  colors?: ThemeColors
  editorColors?: ThemeEditorColors
}

export interface ThemeListItem {
  id: string
  name: string
  author?: string
  type: ThemeType
}
