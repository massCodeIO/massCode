export interface NotesPaths {
  inboxDirPath: string
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

export interface NotesIndexItem {
  filePath: string
  id: number
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
  updatedAt?: number
}

export interface NotesFolderDiskEntry {
  metadata: NotesFolderMetadataFile
  path: string
}

export interface NotesFolderUIState {
  isOpen: number
}

export interface NotesStateFile {
  counters?: {
    folderId?: number
    noteId?: number
    tagId?: number
  }
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
  folderUi: Record<string, NotesFolderUIState>
  folders: NotesFolderRecord[]
  notes: NotesIndexItem[]
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

export interface MarkdownNote {
  content: string
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

export interface NotesRuntimeCache {
  folderById: Map<number, NotesFolderRecord>
  noteById: Map<number, MarkdownNote>
  notes: MarkdownNote[]
  paths: NotesPaths
  searchIndexDirty: boolean
  searchNoteTextById: Map<number, string>
  searchQueryCache: Map<string, number[]>
  searchTokenToNoteIds: Map<string, Set<number>>
  searchTokensByNoteId: Map<number, string[]>
  state: NotesState
}

export interface PersistNoteOptions {
  allowRenameOnConflict?: boolean
  directoryEntriesCache?: Map<string, string[]>
}
