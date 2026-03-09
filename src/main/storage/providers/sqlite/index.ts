import type { StorageProvider } from '../../contracts'
import { createSqliteFoldersStorage } from './folders'
import { createSqliteSnippetsStorage } from './snippets'
import { createSqliteTagsStorage } from './tags'

export const sqliteStorageProvider: StorageProvider = {
  folders: createSqliteFoldersStorage(),
  snippets: createSqliteSnippetsStorage(),
  tags: createSqliteTagsStorage(),
}
