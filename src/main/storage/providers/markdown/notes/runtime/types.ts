import type { InternalLinkLookupItem } from '../../../../../../shared/notes/internalLinks'
import type { SearchIndex } from '../../runtime/shared/searchEngine'

export interface NotesPaths {
  assetsPath: string
  inboxDirPath: string
  legacyAssetsPath: string
  metaDirPath: string
  notesRoot: string
  statePath: string
  trashDirPath: string
}

export interface NotesTagState {
  id: number
  name: string
  createdAt: number
  updatedAt: number
}

// Денормализованные метаданные списка в state.json (слой 4 плана
// icloud-lazy-vault-load): позволяют строить список и placeholder-записи без
// чтения файлов. mtimeMs/size — freshness-сигнатура последнего чтения: пока
// stat совпадает, файл не перечитывается.
export interface NotesIndexMetadata {
  createdAt: number
  description: string | null
  folderId: number | null
  isDeleted: number
  isFavorites: number
  mtimeMs: number
  name: string
  properties: NoteProperties
  size: number
  tags: number[]
  updatedAt: number
}

export interface NotesIndexItem {
  filePath: string
  id: number
  meta?: NotesIndexMetadata
}

export interface NotesFolderRecord {
  id: number
  name: string
  parentId: number | null
  icon: string | null
  isOpen: number
  orderIndex: number
  createdAt: number
  updatedAt: number
}

export interface NotesFolderTreeRecord extends NotesFolderRecord {
  children: NotesFolderTreeRecord[]
}

export interface NotesFolderMetadataFile {
  createdAt?: number
  icon?: string | null
  id?: number
  name?: string
  orderIndex?: number
  // Файл метаданных недокачан из облака: содержимое (и id) неизвестно.
  unavailable?: boolean
  updatedAt?: number
}

export interface NotesFolderDiskEntry {
  metadata: NotesFolderMetadataFile
  path: string
}

export interface NotesFolderUIState {
  isOpen: number
}

// Отложенный rewrite [[ссылок]] для линкеров, чьё содержимое ещё не докачано
// из облака в момент rename/move. Хранится в state сериализуемой спекой
// (замыкание не пережило бы перезапуск): lookup имён до переименования и
// карта «id цели → новый target». Применяется при гидрации линкера.
export interface DeferredBacklinkRewriteOp {
  // Ограничение на вид ссылки: bare — только [[имя]] без пути,
  // path — только [[путь/имя]], any — обе.
  linkKind: 'any' | 'bare' | 'path'
  linkerFolderPathByNoteId: Record<string, string>
  pendingNoteIds: number[]
  preLookup: InternalLinkLookupItem[]
  targetsById: Record<string, string>
}

export interface NotesStateFile {
  counters?: {
    folderId?: number
    noteId?: number
    tagId?: number
  }
  deferredBacklinkRewrites?: DeferredBacklinkRewriteOp[]
  folderIdByPath?: Record<string, number>
  folderUi?: Record<string, { isOpen?: number }>
  folders?: NotesFolderRecord[]
  notes?: NotesIndexItem[]
  tags?: NotesTagState[]
  version?: number
}

export interface NotesState {
  counters: {
    folderId: number
    noteId: number
    tagId: number
  }
  deferredBacklinkRewrites?: DeferredBacklinkRewriteOp[]
  // Персистируемый fallback path → folder id: без него недокачанный
  // .meta.yaml чеканил бы папке новый id на каждом холодном старте.
  folderIdByPath?: Record<string, number>
  folderUi: Record<string, NotesFolderUIState>
  folders: NotesFolderRecord[]
  notes: NotesIndexItem[]
  // Дефолтный state на период, пока state.json не докачан из облака:
  // такой state нельзя ни персистить, ни использовать для выдачи id.
  provisional?: boolean
  tags: NotesTagState[]
  version: number
}

export interface NotesFrontmatter {
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

export type NoteProperties = Record<string, unknown>

export interface MarkdownNote {
  // null — тело ещё не дочитано с диска (запись построена из индекса
  // метаданных); дочитывается через ensureNoteContentLoaded.
  content: string | null
  createdAt: number
  description: string | null
  filePath: string
  folderId: number | null
  id: number
  isDeleted: number
  isFavorites: number
  name: string
  /**
   * Файл заметки — облачный плейсхолдер: содержимое ещё не скачано
   * провайдером, запись показывается в списке и докачивается в фоне.
   */
  pendingCloudDownload?: boolean
  properties: NoteProperties
  tags: number[]
  updatedAt: number
}

export interface NotesRuntimeCache {
  folderById: Map<number, NotesFolderRecord>
  noteById: Map<number, MarkdownNote>
  notes: MarkdownNote[]
  paths: NotesPaths
  searchIndex: SearchIndex
  state: NotesState
}

export interface PersistNoteOptions {
  allowRenameOnConflict?: boolean
  directoryEntriesCache?: Map<string, string[]>
  folderPathMap?: Map<number, string>
  // Move-пути (перенос в trash при удалении папки): файл-плейсхолдер уже
  // перемещён, а перезапись frontmatter не обязательна и не должна валить
  // всю операцию.
  skipWriteIfUnavailable?: boolean
}
