// Constants
export {
  INBOX_DIR_NAME,
  INVALID_NAME_CHARS_RE,
  META_DIR_NAME,
  peekRuntimeCache,
  TRASH_DIR_NAME,
  WINDOWS_RESERVED_NAME_RE,
} from './constants'

// Normalizers
export { normalizeFlag } from './normalizers'

// Parser
export { writeFolderMetadataFile } from './parser'

// Paths
export {
  buildFolderPathMap,
  buildPathToFolderIdMap,
  depthOfRelativePath,
  findFolderById,
  getFolderPathById,
  getNextFolderOrder,
  getPaths,
  getVaultPath,
  normalizeDirectoryPath,
} from './paths'

// Search
export { getSnippetIdsBySearchQuery } from './search'

// Snippets
export {
  buildSnippetTargetPath,
  createSnippetRecord,
  findSnippetByContentId,
  findSnippetById,
  getSnippetTargetDirectory,
  loadSnippets,
  persistSnippet,
  writeSnippetToFile,
} from './snippets'

// State
export {
  createDefaultState,
  ensureStateFile,
  loadState,
  saveState,
} from './state'

// Sync & Cache
export {
  getRuntimeCache,
  resetRuntimeCache,
  setRuntimeCache,
  syncCounters,
  syncFolderMetadataFiles,
  syncRuntimeWithDisk,
  syncSnippetFileWithDisk,
  syncStateWithDisk,
} from './sync'

// Types
export type {
  DirectoryEntriesCache,
  MarkdownBodyFragment,
  MarkdownErrorCode,
  MarkdownFolderDiskEntry,
  MarkdownFolderMetadataFile,
  MarkdownFolderUIState,
  MarkdownFrontmatterContent,
  MarkdownRuntimeCache,
  MarkdownSnippet,
  MarkdownSnippetFrontmatter,
  MarkdownSnippetIndexItem,
  MarkdownState,
  MarkdownStateFile,
  MarkdownTagState,
  Paths,
  PersistSnippetOptions,
  SaveStateOptions,
  SqliteSnippetContentRow,
  SqliteSnippetRow,
  SqliteSnippetTagRow,
} from './types'

// Validation
export {
  assertDirectoryNameAvailable,
  assertNotReservedRootFolderName,
  assertUniqueSiblingFolderName,
  getMarkdownStorageErrorMessage,
  resolveUniqueSiblingFolderName,
  throwStorageError,
  validateEntryName,
} from './validation'
