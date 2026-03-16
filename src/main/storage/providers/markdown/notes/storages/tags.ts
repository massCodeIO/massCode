import type { NoteTagsStorage } from '../../../../contracts'
import { getVaultPath } from '../../runtime/paths'
import { getNotesPaths } from '../runtime/constants'
import { writeNoteToFile } from '../runtime/notes'
import { saveNotesState } from '../runtime/state'
import { getNotesRuntimeCache } from '../runtime/sync'

export function createNoteTagsStorage(): NoteTagsStorage {
  function resolvePaths() {
    return getNotesPaths(getVaultPath())
  }

  function getCache() {
    return getNotesRuntimeCache(resolvePaths())
  }

  return {
    getTags() {
      const { state } = getCache()
      return [...state.tags].sort((a, b) => a.name.localeCompare(b.name))
    },

    createTag(name: string) {
      const paths = resolvePaths()
      const { state } = getNotesRuntimeCache(paths)

      state.counters.tagId += 1
      const tagId = state.counters.tagId
      const now = Date.now()

      state.tags.push({
        createdAt: now,
        id: tagId,
        name: name.trim(),
        updatedAt: now,
      })

      saveNotesState(paths, state)
      return { id: tagId }
    },

    updateTag(id: number, name: string) {
      const paths = resolvePaths()
      const { state } = getNotesRuntimeCache(paths)
      const tag = state.tags.find(t => t.id === id)

      if (!tag) {
        return { notFound: true }
      }

      tag.name = name.trim()
      tag.updatedAt = Date.now()
      saveNotesState(paths, state)

      return { notFound: false }
    },

    deleteTag(id: number) {
      const paths = resolvePaths()
      const { state, notes } = getNotesRuntimeCache(paths)
      const tagIndex = state.tags.findIndex(t => t.id === id)

      if (tagIndex === -1) {
        return { deleted: false }
      }

      state.tags.splice(tagIndex, 1)

      for (const note of notes) {
        const idx = note.tags.indexOf(id)
        if (idx !== -1) {
          note.tags.splice(idx, 1)
          writeNoteToFile(paths, note)
        }
      }

      saveNotesState(paths, state)
      return { deleted: true }
    },
  }
}
