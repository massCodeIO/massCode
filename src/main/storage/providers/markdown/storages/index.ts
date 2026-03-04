import type { StorageProvider } from '../../../contracts'
import { createFoldersStorage } from './folders'
import { createSnippetsStorage } from './snippets'
import { createTagsStorage } from './tags'

export function createMarkdownStorageProvider(): StorageProvider {
  return {
    folders: createFoldersStorage(),
    snippets: createSnippetsStorage(),
    tags: createTagsStorage(),
  }
}
