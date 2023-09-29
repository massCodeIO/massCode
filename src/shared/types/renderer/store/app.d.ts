import type { MarkdownSettings } from '@shared/types/main/store'

export type Theme =
  | 'dark:dracula'
  | 'dark:material-palenight'
  | 'dark:material'
  | 'dark:merbivore'
  | 'dark:monokai'
  | 'dark:one'
  | 'dark:tokyo-night'
  | 'light:github'
  | 'light:material'
  | 'light:solarized'

export interface AppSizes {
  titlebar: number
  sidebar: number
  snippetList: number
  codePreviewHeight: number
  editor: {
    titleHeight: number
    fragmentsHeight: number
    tagsHeight: number
    footerHeight: number
    descriptionHeight: number
  }
}

export interface EditorSettings {
  fontSize: number
  fontFamily: string
  wrap: boolean
  tabSize: number
  trailingComma: 'all' | 'none' | 'es5'
  semi: boolean
  singleQuote: boolean
  highlightLine: boolean
  highlightGutter: boolean
  matchBrackets: boolean
}

export interface ScreenshotSettings {
  background: boolean
  gradient: [string, string]
  darkMode: boolean
  width: number
}

export interface CodePreviewSettings {
  darkMode: boolean
}

export interface State {
  platform: NodeJS.Platform
  theme: Theme
  sizes: AppSizes
  showTags: boolean
  showModal: boolean
  version: string
  editor: EditorSettings
  selectedPreferencesMenu: string
  selectedDevtoolsMenu: string
  screenshot: ScreenshotSettings
  markdown: MarkdownSettings
  codePreview: CodePreviewSettings
  language: string
  history: string[]
  historyIndex: number
  isInit: boolean
  isSponsored: boolean
}
