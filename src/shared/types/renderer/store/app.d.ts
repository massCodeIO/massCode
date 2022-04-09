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
  theme: string
  sizes: AppSizes
  showTags: boolean
  version: string
  isInit: boolean
}
