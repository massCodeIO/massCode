export interface AppSizes {
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
}
