import type { Ace } from 'ace-builds'

export type Theme =
  | 'dark:dracula'
  | 'dark:merbivore'
  | 'dark:monokai'
  | 'dark:one'
  | 'light:chrome'
  | 'light:solarized'
  | 'light:textmate'
  | 'light:xcode'

export type ThemeEditor =
  | 'chrome'
  | 'dracula'
  | 'merbivore_soft'
  | 'monokai'
  | 'one_dark'
  | 'solarized_light'
  | 'textmate'
  | 'xcode'

export interface AppSizes {
  titlebar: number
  sidebar: number
  snippetList: number
  editor: {
    titleHeight: number
    fragmentsHeight: number
    tagsHeight: number
    footerHeight: number
  }
}

export interface EditorSettings {
  showInvisibles: boolean
  fontSize: number
  fontFamily: string
  wrap: Ace.EditSessionOptions['wrap']
  tabSize: number
  trailingComma: 'all' | 'none' | 'es5'
  semi: boolean
  singleQuote: boolean
  theme: ThemeEditor
  highlightLine: boolean
  highlightGutter: boolean
}

export interface State {
  platform: NodeJS.Platform
  theme: Theme
  sizes: AppSizes
  showTags: boolean
  version: string
  editor: EditorSettings
  selectedPreferencesMenu: string
  isInit: boolean
}
