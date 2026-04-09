export { peekRuntimeCache } from './cache'

// Constants
export {
  CODE_SPACE_ID,
  INBOX_DIR_NAME,
  INVALID_NAME_CHARS_RE,
  LEGACY_FOLDER_META_FILE_NAME,
  MATH_SPACE_ID,
  META_DIR_NAME,
  META_FILE_NAME,
  NOTES_SPACE_ID,
  PERSISTED_SPACE_IDS,
  SPACE_IDS,
  SPACE_STATE_FILE_NAME,
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
  hasMarkdownVaultData,
  normalizeDirectoryPath,
} from './paths'

// Search
export { getSnippetIdsBySearchQuery } from './search'
// Shared folder utilities
export {
  buildFolderTree,
  collectDescendantIds,
  normalizeFolderOrderIndices,
  reorderFolderSiblings,
  sortFoldersForTree,
} from './shared/folderIndex'

export type { WithChildren } from './shared/folderIndex'
export { readYamlObjectFile, writeYamlObjectFile } from './shared/yaml'

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
  ensureFlatSpacesLayout,
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
