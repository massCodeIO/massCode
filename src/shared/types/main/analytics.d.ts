type CombineWith<T extends string, U extends string> = `${U}/${T}`

type SnippetEvents =
  | 'add-description'
  | 'add-fragment'
  | 'add-new'
  | 'add-tag'
  | 'add-to-favorites'
  | 'code-preview'
  | 'copy'
  | 'copy-link'
  | 'create-screenshot'
  | 'delete-fragment'
  | 'delete-from-favorites'
  | 'delete'
  | 'duplicate'
  | 'format'
  | 'markdown-preview'
  | 'move-to-trash'
  | 'restore-from-trash'
  | 'search'
  | 'set-language'

type FolderEvents = 'add-new' | 'delete' | 'set-language'
type TagEvents = 'add-new' | 'delete'

type AppEvents =
  | 'move-storage'
  | 'open-storage'
  | 'new-storage'
  | 'open-url'
  | 'migrate'
  | 'update'
  | 'install'
  | 'empty-trash'
  | 'set-theme'
  | 'notify'
  | 'set-language'

type ApiEvents = 'snippet-create'
type PageEvents = 'main' | 'preferences' | 'presentation'

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
  | PageEvents
