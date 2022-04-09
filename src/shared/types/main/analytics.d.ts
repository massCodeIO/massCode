type CombineWith<T extends string, U extends string> = `${U}/${T}`

type SnippetEvents =
  | 'add-fragment'
  | 'add-new'
  | 'add-tag'
  | 'add-to-favorites'
  | 'copy'
  | 'delete-fragment'
  | 'delete-from-favorites'
  | 'delete'
  | 'duplicate'
  | 'move-to-trash'
  | 'set-language'
  | 'search'
type FolderEvents = 'add-new' | 'delete' | 'set-language'
type TagEvents = 'add-new' | 'delete'
type AppEvents =
  | 'move-storage'
  | 'open-storage'
  | 'migrate'
  | 'update'
  | 'empty-trash'

type TrackSnippetEvents = CombineWith<SnippetEvents, 'snippets'>
type TrackFolderEvents = CombineWith<FolderEvents, 'folders'>
type TrackTagEvents = CombineWith<TagEvents, 'tags'>
type TrackAppEvents = CombineWith<AppEvents, 'app'>

export type TrackEvents =
  | TrackSnippetEvents
  | TrackFolderEvents
  | TrackTagEvents
  | TrackAppEvents
  | 'main'
  | 'preferences'
