import type { TagsStorage } from '../../../contracts'
import {
  getPaths,
  getRuntimeCache,
  getVaultPath,
  saveState,
  writeSnippetToFile,
} from '../runtime'

export function createTagsStorage(): TagsStorage {
  return {
    getTags: () => {
      const paths = getPaths(getVaultPath())
      const { state } = getRuntimeCache(paths)

      return state.tags
        .map(tag => ({
          id: tag.id,
          name: tag.name,
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    },
    createTag: (name) => {
      const paths = getPaths(getVaultPath())
      const { state } = getRuntimeCache(paths)

      const id = state.counters.tagId + 1
      state.counters.tagId = id

      const now = Date.now()
      state.tags.push({
        createdAt: now,
        id,
        name,
        updatedAt: now,
      })

      saveState(paths, state)

      return { id }
    },
    deleteTag: (id) => {
      const paths = getPaths(getVaultPath())
      const { state, snippets } = getRuntimeCache(paths)

      const tagIndex = state.tags.findIndex(tag => tag.id === id)
      if (tagIndex === -1) {
        return { deleted: false }
      }

      state.tags.splice(tagIndex, 1)

      snippets.forEach((snippet) => {
        if (snippet.tags.includes(id)) {
          snippet.tags = snippet.tags.filter(tagId => tagId !== id)
          writeSnippetToFile(paths, snippet)
        }
      })

      saveState(paths, state)

      return { deleted: true }
    },
  }
}
