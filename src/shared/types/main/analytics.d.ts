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
  | 'format'
type FolderEvents = 'add-new' | 'delete' | 'set-language'
type TagEvents = 'add-new' | 'delete'
type AppEvents =
  | 'move-storage'
  | 'open-storage'
  | 'migrate'
  | 'update'
  | 'install'
  | 'empty-trash'
  | 'set-theme'
  | 'notify'
type ApiEvents = 'snippet-create'

type TrackSnippetEvents = CombineWith<SnippetEvents, 'snippets'>
type TrackFolderEvents = CombineWith<FolderEvents, 'folders'>
type TrackTagEvents = CombineWith<TagEvents, 'tags'>
type TrackAppEvents = CombineWith<AppEvents, 'app'>
type TrackApiEvents = CombineWith<ApiEvents, 'api'>

export type TrackEvents =
  | TrackSnippetEvents
  | TrackFolderEvents
  | TrackTagEvents
  | TrackAppEvents
  | TrackApiEvents
  | 'main'
  | 'preferences'
