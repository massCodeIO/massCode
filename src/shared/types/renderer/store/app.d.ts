export interface AppSizes {
  titlebar: number
  editor: {
    titleHeight: number
    fragmentsHeight: number
    tagsHeight: number
    footerHeight: number
  }
}

export interface State {
  platform: NodeJS.Platform
  theme: string
  sizes: AppSizes
  showTags: boolean
  version: string
  isInit: boolean
}
