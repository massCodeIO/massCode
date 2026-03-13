// Constants
export {
  INBOX_DIR_NAME,
  INVALID_NAME_CHARS_RE,
  LEGACY_FOLDER_META_FILE_NAME,
  META_DIR_NAME,
  META_FILE_NAME,
  peekRuntimeCache,
  SPACE_STATE_FILE_NAME,
  SPACES_DIR_NAME,
  TRASH_DIR_NAME,
  WINDOWS_RESERVED_NAME_RE,
} from './constants'

// Normalizers
export { normalizeFlag, normalizeFolderOrderIndices } from './normalizers'

// Parser
export {
  readYamlObjectFile,
  writeFolderMetadataFile,
  writeYamlObjectFile,
} from './parser'

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

// Spaces
export {
  ensureSpaceDirectory,
  getSpaceDirPath,
  getSpaceStatePath,
} from './spaces'

// Space State
export {
  readSpaceState,
  writeSpaceState,
  writeSpaceStateImmediate,
} from './spaceState'

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
