import type { Ace } from 'ace-builds'

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
}
export interface State {
  platform: NodeJS.Platform
  theme: string
  sizes: AppSizes
  showTags: boolean
  version: string
  editor: EditorSettings
  selectedPreferencesMenu: string
  isInit: boolean
}
