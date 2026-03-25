import type { TagsStorage } from '../../../contracts'
import type { MarkdownSnippet } from '../runtime'
import {
  getPaths,
  getRuntimeCache,
  getVaultPath,
  saveState,
  writeSnippetToFile,
} from '../runtime'
import {
  createTagInState,
  deleteTagFromStateAndEntities,
  getSortedTagRecords,
} from '../runtime/shared/tags'

export function createTagsStorage(): TagsStorage {
  return {
    getTags: () => {
      const paths = getPaths(getVaultPath())
      const { state } = getRuntimeCache(paths)

      return getSortedTagRecords(state.tags)
    },
    createTag: (name) => {
      const paths = getPaths(getVaultPath())
      const { state } = getRuntimeCache(paths)

      const result = createTagInState(state, name, ({ id, name, now }) => ({
        createdAt: now,
        id,
        name,
        updatedAt: now,
      }))

      saveState(paths, state)

      return result
    },
    deleteTag: (id) => {
      const paths = getPaths(getVaultPath())
      const { state, snippets } = getRuntimeCache(paths)

      const result = deleteTagFromStateAndEntities(
        state,
        snippets,
        id,
        (snippet: MarkdownSnippet) => {
          writeSnippetToFile(paths, snippet)
        },
      )
      if (!result.deleted) {
        return result
      }

      saveState(paths, state)

      return result
    },
  }
}
