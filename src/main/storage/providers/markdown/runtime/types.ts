import type { FolderRecord, TagRecord } from '../../../contracts'

export interface MarkdownTagState extends TagRecord {
  createdAt: number
  updatedAt: number
}

export interface MarkdownSnippetIndexItem {
  filePath: string
  id: number
}

export interface MarkdownFolderMetadataFile {
  createdAt?: number
  defaultLanguage?: string
  icon?: string | null
  masscode_id?: number
  name?: string
  orderIndex?: number
  updatedAt?: number
}

export interface MarkdownFolderDiskEntry {
  metadata: MarkdownFolderMetadataFile
  path: string
}

export interface MarkdownFolderUIState {
  isOpen: number
}

export interface MarkdownStateFile {
  counters?: {
    contentId?: number
    folderId?: number
    snippetId?: number
    tagId?: number
  }
  folderUi?: Record<string, { isOpen?: number }>
  folders?: FolderRecord[]
  snippets?: MarkdownSnippetIndexItem[]
  tags?: MarkdownTagState[]
  version?: number
}

export interface MarkdownState {
  counters: {
    contentId: number
    folderId: number
    snippetId: number
    tagId: number
  }
  folderUi: Record<string, MarkdownFolderUIState>
  folders: FolderRecord[]
  snippets: MarkdownSnippetIndexItem[]
  tags: MarkdownTagState[]
  version: number
}

export interface MarkdownFrontmatterContent {
  id?: number
  label?: string
  language?: string
}

export interface MarkdownSnippetFrontmatter {
  contents?: MarkdownFrontmatterContent[]
  createdAt?: number
  description?: string | null
  folderId?: number | null
  id?: number
  isDeleted?: number
  isFavorites?: number
  name?: string
  tags?: number[]
  updatedAt?: number
}

export interface MarkdownBodyFragment {
  label: string
  language: string
  value: string | null
}

export interface MarkdownSnippet {
  contents: {
    id: number
    label: string
    language: string
    value: string | null
  }[]
  createdAt: number
  description: string | null
  filePath: string
  folderId: number | null
  id: number
  isDeleted: number
  isFavorites: number
  name: string
  tags: number[]
  updatedAt: number
}

export interface MarkdownRuntimeCache {
  contentOwnerByContentId: Map<
    number,
    {
      contentIndex: number
      snippet: MarkdownSnippet
    }
  >
  folderById: Map<number, FolderRecord>
  paths: Paths
  searchQueryCache: Map<string, number[]>
  searchSnippetTextById: Map<number, string>
  searchTokenToSnippetIds: Map<string, Set<number>>
  searchTokensBySnippetId: Map<number, string[]>
  searchIndexDirty: boolean
  snippetById: Map<number, MarkdownSnippet>
  snippets: MarkdownSnippet[]
  state: MarkdownState
}

export interface SaveStateOptions {
  immediate?: boolean
}

export interface SqliteSnippetRow {
  createdAt: number
  description: string | null
  folderId: number | null
  id: number
  isDeleted: number
  isFavorites: number
  name: string
  updatedAt: number
}

export interface SqliteSnippetContentRow {
  id: number
  label: string | null
  language: string | null
  snippetId: number
  value: string | null
}

export interface SqliteSnippetTagRow {
  snippetId: number
  tagId: number
}

export interface Paths {
  inboxDirPath: string
  metaDirPath: string
  statePath: string
  trashDirPath: string
  vaultPath: string
}

export type MarkdownErrorCode =
  | 'FOLDER_NOT_FOUND'
  | 'INVALID_NAME'
  | 'NAME_CONFLICT'
  | 'RESERVED_NAME'
  | 'SNIPPET_NOT_FOUND'

export type DirectoryEntriesCache = Map<string, string[]>

export interface PersistSnippetOptions {
  allowRenameOnConflict?: boolean
  directoryEntriesCache?: Map<string, string[]>
}
