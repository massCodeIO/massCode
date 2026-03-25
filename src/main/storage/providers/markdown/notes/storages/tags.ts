import type { NoteTagsStorage } from '../../../../contracts'
import { getVaultPath } from '../../runtime/paths'
import {
  createTagInState,
  deleteTagFromStateAndEntities,
  getSortedTagRecords,
  updateTagInState,
} from '../../runtime/shared/tags'
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
      return getSortedTagRecords(state.tags)
    },

    createTag(name: string) {
      const paths = resolvePaths()
      const { state } = getNotesRuntimeCache(paths)

      const result = createTagInState(
        state,
        name.trim(),
        ({ id, name, now }) => ({
          createdAt: now,
          id,
          name,
          updatedAt: now,
        }),
      )

      saveNotesState(paths, state)
      return result
    },

    updateTag(id: number, name: string) {
      const paths = resolvePaths()
      const { state } = getNotesRuntimeCache(paths)
      const result = updateTagInState(state.tags, id, name.trim())
      if (result.notFound) {
        return result
      }
      saveNotesState(paths, state)

      return result
    },

    deleteTag(id: number) {
      const paths = resolvePaths()
      const { state, notes } = getNotesRuntimeCache(paths)
      const result = deleteTagFromStateAndEntities(state, notes, id, (note) => {
        writeNoteToFile(paths, note)
      })
      if (!result.deleted) {
        return result
      }

      saveNotesState(paths, state)
      return result
    },
  }
}
