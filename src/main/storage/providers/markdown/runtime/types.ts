import type { FolderRecord, TagRecord } from '../../../contracts'
import type { SearchIndex } from './shared/searchEngine'

export interface MarkdownTagState extends TagRecord {
  createdAt: number
  updatedAt: number
}

export interface MarkdownSnippetIndexContentMetadata {
  id: number
  label: string
  language: string
}

// Денормализованные метаданные списка в state.json (слой 4 плана
// icloud-lazy-vault-load): позволяют строить список и placeholder-записи без
// чтения файлов. mtimeMs/size — freshness-сигнатура последнего чтения: пока
// stat совпадает, файл не перечитывается.
export interface MarkdownSnippetIndexMetadata {
  contents: MarkdownSnippetIndexContentMetadata[]
  createdAt: number
  description: string | null
  isDeleted: number
  isFavorites: number
  mtimeMs: number
  name: string
  size: number
  tags: number[]
  updatedAt: number
}

export interface MarkdownSnippetIndexItem {
  filePath: string
  id: number
  meta?: MarkdownSnippetIndexMetadata
}

export interface MarkdownFolderMetadataFile {
  createdAt?: number
  defaultLanguage?: string
  icon?: string | null
  id?: number
  /** @deprecated Use `id` instead. Kept for legacy `.masscode-folder.yml` migration. */
  masscode_id?: number
  name?: string
  orderIndex?: number
  // Файл метаданных недокачан из облака: содержимое (и id) неизвестно.
  unavailable?: boolean
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
  folderIdByPath?: Record<string, number>
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
  // Персистируемый fallback path → folder id: без него недокачанный
  // .meta.yaml чеканил бы папке новый id на каждом холодном старте.
  folderIdByPath?: Record<string, number>
  folderUi: Record<string, MarkdownFolderUIState>
  folders: FolderRecord[]
  // Дефолтный state на период, пока state.json не докачан из облака:
  // такой state нельзя ни персистить, ни использовать для выдачи id.
  provisional?: boolean
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
  /**
   * Файл сниппета — облачный плейсхолдер: содержимое ещё не скачано
   * провайдером, запись показывается в списке и докачивается в фоне.
   */
  pendingCloudDownload?: boolean
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
  searchIndex: SearchIndex
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
  | 'VAULT_HYDRATING'

export type DirectoryEntriesCache = Map<string, string[]>

export interface PersistSnippetOptions {
  allowRenameOnConflict?: boolean
  directoryEntriesCache?: Map<string, string[]>
  // Каллер проверил source до мутации и move: после переноса runtime может
  // безопасно выполнить одну запись resident/zero-block файла по новому пути.
  sourceFileVerifiedLocal?: boolean
  // Move-пути (перенос в trash при удалении папки): файл-плейсхолдер уже
  // перемещён, а перезапись frontmatter не обязательна и не должна валить
  // всю операцию.
  skipWriteIfUnavailable?: boolean
}
