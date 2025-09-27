export const LibraryFilter = {
  All: 'all',
  Favorites: 'favorites',
  Inbox: 'inbox',
  Trash: 'trash',
} as const

export const LibraryTab = {
  Library: 'library',
  Tags: 'tags',
} as const

export type StateAction = 'beforeSearch'

export interface SavedState {
  snippetId?: number
  snippetContentIndex?: number
  folderId?: number
  tagId?: number
  libraryFilter?: (typeof LibraryFilter)[keyof typeof LibraryFilter]
}
