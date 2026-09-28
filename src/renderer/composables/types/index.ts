import type { LayoutMode } from '../layoutModes'

export const LibraryFilter = {
  All: 'all',
  Completed: 'completed',
  Favorites: 'favorites',
  Inbox: 'inbox',
  Tasks: 'tasks',
  Today: 'today',
  Trash: 'trash',
  Upcoming: 'upcoming',
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
  codeLayoutMode?: LayoutMode
  isSidebarHidden?: boolean
}
