import type {
  HttpAuth,
  HttpBodyType,
  HttpEnvironmentRecord,
  HttpFolderRecord,
  HttpFolderTreeRecord,
  HttpFormDataEntry,
  HttpHeaderEntry,
  HttpHistoryRecord,
  HttpMethod,
  HttpQueryEntry,
  HttpRequestRecord,
} from './providers/markdown/http/runtime/types'
import type {
  NotesFolderRecord,
  NotesFolderTreeRecord,
} from './providers/markdown/notes/runtime/types'

export interface TagRecord {
  id: number
  name: string
}

export interface FolderRecord {
  id: number
  name: string
  createdAt: number
  updatedAt: number
  icon: string | null
  parentId: number | null
  isOpen: number
  defaultLanguage: string
  orderIndex: number
}

export interface FolderTreeRecord extends FolderRecord {
  children: FolderTreeRecord[]
}

export interface FolderCreateInput {
  name: string
  parentId?: number | null
}

export interface FolderUpdateInput {
  name?: string
  icon?: string | null
  defaultLanguage?: string
  parentId?: number | null
  isOpen?: number
  orderIndex?: number
}

export interface FolderUpdateResult {
  invalidInput: boolean
  notFound: boolean
}

export interface FoldersStorage {
  createFolder: (input: FolderCreateInput) => { id: number }
  deleteFolder: (id: number) => { deleted: boolean }
  getFolders: () => FolderRecord[]
  getFoldersTree: () => FolderTreeRecord[]
  updateFolder: (id: number, input: FolderUpdateInput) => FolderUpdateResult
}

export interface SnippetTagRecord {
  id: number
  name: string
}

export interface SnippetFolderRecord {
  id: number
  name: string
}

export interface SnippetContentRecord {
  id: number
  label: string
  language: string
  value: string | null
}

export interface SnippetRecord {
  id: number
  name: string
  description: string | null
  tags: SnippetTagRecord[]
  folder: SnippetFolderRecord | null
  contents: SnippetContentRecord[]
  isFavorites: number
  isDeleted: number
  createdAt: number
  updatedAt: number
}

export interface SnippetsQueryInput {
  search?: string
  order?: 'ASC' | 'DESC'
  folderId?: number
  tagId?: number
  isFavorites?: number
  isDeleted?: number
  isInbox?: number
}

export interface SnippetCreateInput {
  name: string
  folderId?: number | null
}

export interface SnippetUpdateInput {
  name?: string
  folderId?: number | null
  description?: string | null
  isDeleted?: number
  isFavorites?: number
}

export interface SnippetContentCreateInput {
  label: string
  value: string | null
  language: string
}

export interface SnippetContentUpdateInput {
  label?: string
  value?: string | null
  language?: string
}

export interface SnippetUpdateResult {
  invalidInput: boolean
  notFound: boolean
}

export interface SnippetContentUpdateResult {
  invalidInput: boolean
  notFound: boolean
  parentNotFound: boolean
}

export interface SnippetTagRelationResult {
  notFound: false
  snippetFound: boolean
  tagFound: boolean
}

export interface SnippetTagDeleteRelationResult {
  notFound: false
  snippetFound: boolean
  tagFound: boolean
  relationFound: boolean
}

export interface SnippetsCount {
  total: number
  trash: number
}

export interface SnippetsStorage {
  addTagToSnippet: (
    snippetId: number,
    tagId: number,
  ) => SnippetTagRelationResult
  createSnippet: (input: SnippetCreateInput) => { id: number }
  createSnippetContent: (
    snippetId: number,
    input: SnippetContentCreateInput,
  ) => { id: number }
  deleteSnippet: (id: number) => { deleted: boolean }
  deleteSnippetContent: (contentId: number) => { deleted: boolean }
  deleteTagFromSnippet: (
    snippetId: number,
    tagId: number,
  ) => SnippetTagDeleteRelationResult
  emptyTrash: () => { deletedCount: number }
  getSnippetById: (id: number) => SnippetRecord | null
  getSnippets: (query: SnippetsQueryInput) => SnippetRecord[]
  getSnippetsCounts: () => SnippetsCount
  updateSnippet: (id: number, input: SnippetUpdateInput) => SnippetUpdateResult
  updateSnippetContent: (
    snippetId: number,
    contentId: number,
    input: SnippetContentUpdateInput,
  ) => SnippetContentUpdateResult
}

export interface TagsStorage {
  createTag: (name: string) => { id: number }
  deleteTag: (id: number) => { deleted: boolean }
  getTags: () => TagRecord[]
}

export interface StorageProvider {
  folders: FoldersStorage
  snippets: SnippetsStorage
  tags: TagsStorage
}

// --- Notes Space Contracts ---

export interface NoteRecord {
  id: number
  name: string
  description: string | null
  content: string
  tags: NoteTagRecord[]
  folder: NoteFolderInfo | null
  isFavorites: number
  isDeleted: number
  createdAt: number
  updatedAt: number
}

export interface NoteTagRecord {
  id: number
  name: string
}

export interface NoteFolderInfo {
  id: number
  name: string
}

export interface NotesQueryInput {
  search?: string
  order?: 'ASC' | 'DESC'
  folderId?: number
  tagId?: number
  isFavorites?: number
  isDeleted?: number
  isInbox?: number
}

export interface NoteCreateInput {
  name: string
  folderId?: number | null
}

export interface NoteUpdateInput {
  name?: string
  folderId?: number | null
  description?: string | null
  isDeleted?: number
  isFavorites?: number
}

export interface NoteUpdateResult {
  invalidInput: boolean
  notFound: boolean
}

export interface NoteTagRelationResult {
  notFound: false
  noteFound: boolean
  tagFound: boolean
}

export interface NoteTagDeleteRelationResult {
  notFound: false
  noteFound: boolean
  tagFound: boolean
  relationFound: boolean
}

export interface NotesCount {
  total: number
  trash: number
}

export interface NoteFolderCreateInput {
  name: string
  parentId?: number | null
}

export interface NoteFolderUpdateInput {
  name?: string
  icon?: string | null
  parentId?: number | null
  isOpen?: number
  orderIndex?: number
}

export interface NoteFolderUpdateResult {
  invalidInput: boolean
  notFound: boolean
}

export interface NotesStorageProvider {
  folders: NotesFoldersStorage
  notes: NotesStorage
  tags: NoteTagsStorage
}

export interface NotesFoldersStorage {
  createFolder: (input: NoteFolderCreateInput) => { id: number }
  deleteFolder: (id: number) => { deleted: boolean }
  getFolders: () => NotesFolderRecord[]
  getFoldersTree: () => NotesFolderTreeRecord[]
  updateFolder: (
    id: number,
    input: NoteFolderUpdateInput,
  ) => NoteFolderUpdateResult
}

export interface NotesStorage {
  addTagToNote: (noteId: number, tagId: number) => NoteTagRelationResult
  createNote: (input: NoteCreateInput) => { id: number }
  deleteNote: (id: number) => { deleted: boolean }
  deleteTagFromNote: (
    noteId: number,
    tagId: number,
  ) => NoteTagDeleteRelationResult
  emptyTrash: () => { deletedCount: number }
  getNoteById: (id: number) => NoteRecord | null
  getNotes: (query: NotesQueryInput) => NoteRecord[]
  getNotesCounts: () => NotesCount
  updateNote: (id: number, input: NoteUpdateInput) => NoteUpdateResult
  updateNoteContent: (id: number, content: string) => NoteUpdateResult
}

export interface NoteTagsStorage {
  createTag: (name: string) => { id: number }
  deleteTag: (id: number) => { deleted: boolean }
  getTags: () => NoteTagRecord[]
  updateTag: (id: number, name: string) => { notFound: boolean }
}

// --- HTTP Space Contracts ---

export interface HttpFolderCreateInput {
  name: string
  icon?: string | null
  parentId?: number | null
}

export interface HttpFolderUpdateInput {
  name?: string
  icon?: string | null
  parentId?: number | null
  isOpen?: number
  orderIndex?: number
}

export interface HttpFolderUpdateResult {
  invalidInput: boolean
  notFound: boolean
}

export interface HttpRequestsQueryInput {
  search?: string
}

export interface HttpRequestCreateInput {
  name: string
  folderId?: number | null
  method?: HttpMethod
  url?: string
}

export interface HttpRequestUpdateInput {
  name?: string
  folderId?: number | null
  method?: HttpMethod
  url?: string
  headers?: HttpHeaderEntry[]
  query?: HttpQueryEntry[]
  bodyType?: HttpBodyType
  body?: string | null
  formData?: HttpFormDataEntry[]
  auth?: HttpAuth
  description?: string
}

export interface HttpRequestUpdateResult {
  invalidInput: boolean
  notFound: boolean
}

export interface HttpEnvironmentCreateInput {
  name: string
  variables?: Record<string, string>
}

export interface HttpEnvironmentUpdateInput {
  name?: string
  variables?: Record<string, string>
}

export interface HttpEnvironmentUpdateResult {
  invalidInput: boolean
  notFound: boolean
}

export interface HttpHistoryAppendInput {
  requestId: number | null
  method: HttpMethod
  url: string
  status: number | null
  durationMs: number
  sizeBytes: number
  requestedAt: number
  error?: string
}

export interface HttpFoldersStorage {
  createFolder: (input: HttpFolderCreateInput) => { id: number }
  deleteFolder: (id: number) => { deleted: boolean }
  getFolders: () => HttpFolderRecord[]
  getFoldersTree: () => HttpFolderTreeRecord[]
  updateFolder: (
    id: number,
    input: HttpFolderUpdateInput,
  ) => HttpFolderUpdateResult
}

export interface HttpRequestsStorage {
  createRequest: (input: HttpRequestCreateInput) => { id: number }
  deleteRequest: (id: number) => { deleted: boolean }
  getRequestById: (id: number) => HttpRequestRecord | null
  getRequests: (query?: HttpRequestsQueryInput) => HttpRequestRecord[]
  updateRequest: (
    id: number,
    input: HttpRequestUpdateInput,
  ) => HttpRequestUpdateResult
}

export interface HttpEnvironmentsStorage {
  createEnvironment: (input: HttpEnvironmentCreateInput) => { id: number }
  deleteEnvironment: (id: number) => { deleted: boolean }
  getActiveEnvironmentId: () => number | null
  getEnvironments: () => HttpEnvironmentRecord[]
  setActiveEnvironment: (id: number | null) => { notFound: boolean }
  updateEnvironment: (
    id: number,
    input: HttpEnvironmentUpdateInput,
  ) => HttpEnvironmentUpdateResult
}

export interface HttpHistoryStorage {
  appendEntry: (input: HttpHistoryAppendInput) => { id: number }
  clear: () => void
  getEntries: () => HttpHistoryRecord[]
}

export interface HttpStorageProvider {
  environments: HttpEnvironmentsStorage
  folders: HttpFoldersStorage
  history: HttpHistoryStorage
  requests: HttpRequestsStorage
}
