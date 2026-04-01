import type { NoteItemResponse, NotesResponse } from '../dto/notes'
import Elysia from 'elysia'
import { useNotesStorage } from '../../storage'
import {
  commonAddResponse,
  commonMessageResponse,
} from '../dto/common/response'
import { notesDTO } from '../dto/notes'

const app = new Elysia({ prefix: '/notes' })

function parseStorageError(
  error: unknown,
): { code: string, message: string } | null {
  if (!(error instanceof Error)) {
    return null
  }

  const separatorIndex = error.message.indexOf(':')
  if (separatorIndex <= 0) {
    return null
  }

  return {
    code: error.message.slice(0, separatorIndex),
    message: error.message.slice(separatorIndex + 1).trim(),
  }
}

function mapStorageError(status: unknown, error: unknown): never {
  const setStatus = status as (
    code: number,
    payload: { message: string },
  ) => never
  const parsedError = parseStorageError(error)

  if (!parsedError) {
    return setStatus(500, { message: 'Internal storage error' })
  }

  if (parsedError.code === 'NAME_CONFLICT') {
    return setStatus(409, { message: parsedError.message })
  }

  if (
    parsedError.code === 'FOLDER_NOT_FOUND'
    || parsedError.code === 'NOTE_NOT_FOUND'
  ) {
    return setStatus(404, { message: parsedError.message })
  }

  if (
    parsedError.code === 'INVALID_NAME'
    || parsedError.code === 'RESERVED_NAME'
  ) {
    return setStatus(400, { message: parsedError.message })
  }

  return setStatus(500, {
    message: parsedError.message || 'Internal storage error',
  })
}

app
  .use(notesDTO)
  .get(
    '/',
    ({ query }) => {
      const storage = useNotesStorage()
      const result = storage.notes.getNotes(query)

      return result as NotesResponse
    },
    {
      query: 'notesQuery',
      response: 'notesResponse',
      detail: {
        tags: ['Notes'],
      },
    },
  )
  .get(
    '/counts',
    () => {
      const storage = useNotesStorage()
      return storage.notes.getNotesCounts()
    },
    {
      response: 'notesCountsResponse',
      detail: {
        tags: ['Notes'],
      },
    },
  )
  .get(
    '/:id',
    ({ params, status }) => {
      const storage = useNotesStorage()
      const note = storage.notes.getNoteById(Number(params.id))

      if (!note) {
        return status(404, { message: 'Note not found' })
      }

      return note as NoteItemResponse
    },
    {
      response: {
        200: 'noteItemResponse',
        404: commonMessageResponse,
      },
      detail: {
        tags: ['Notes'],
      },
    },
  )
  .post(
    '/',
    ({ body, status }) => {
      const storage = useNotesStorage()
      try {
        const { id } = storage.notes.createNote(body)

        return { id }
      }
      catch (error) {
        return mapStorageError(status, error)
      }
    },
    {
      body: 'notesAdd',
      response: commonAddResponse,
      detail: {
        tags: ['Notes'],
      },
    },
  )
  .patch(
    '/:id',
    ({ params, body, status }) => {
      const storage = useNotesStorage()
      try {
        const { invalidInput, notFound } = storage.notes.updateNote(
          Number(params.id),
          body,
        )

        if (invalidInput) {
          return status(400, { message: 'Need at least one field to update' })
        }

        if (notFound) {
          return status(404, { message: 'Note not found' })
        }

        return { message: 'Note updated' }
      }
      catch (error) {
        return mapStorageError(status, error)
      }
    },
    {
      body: 'notesUpdate',
      detail: {
        tags: ['Notes'],
      },
    },
  )
  .patch(
    '/:id/content',
    ({ params, body, status }) => {
      const storage = useNotesStorage()
      const { notFound } = storage.notes.updateNoteContent(
        Number(params.id),
        body.content,
      )

      if (notFound) {
        return status(404, { message: 'Note not found' })
      }

      return { message: 'Note content updated' }
    },
    {
      body: 'notesContentUpdate',
      detail: {
        tags: ['Notes'],
      },
    },
  )
  .post(
    '/:id/tags/:tagId',
    ({ params, status }) => {
      const storage = useNotesStorage()
      const { noteFound, tagFound } = storage.notes.addTagToNote(
        Number(params.id),
        Number(params.tagId),
      )

      if (!noteFound) {
        return status(404, { message: 'Note not found' })
      }

      if (!tagFound) {
        return status(404, { message: 'Tag not found' })
      }

      return { message: 'Tag added to note' }
    },
    {
      detail: {
        tags: ['Notes'],
      },
    },
  )
  .delete(
    '/:id/tags/:tagId',
    ({ params, status }) => {
      const storage = useNotesStorage()
      const { noteFound, tagFound, relationFound }
        = storage.notes.deleteTagFromNote(
          Number(params.id),
          Number(params.tagId),
        )

      if (!noteFound) {
        return status(404, { message: 'Note not found' })
      }

      if (!tagFound) {
        return status(404, { message: 'Tag not found' })
      }

      if (!relationFound) {
        return status(404, {
          message: 'Tag is not associated with this note',
        })
      }

      return { message: 'Tag removed from note' }
    },
    {
      detail: {
        tags: ['Notes'],
      },
    },
  )
  .delete(
    '/:id',
    ({ params, status }) => {
      const storage = useNotesStorage()
      const { deleted } = storage.notes.deleteNote(Number(params.id))

      if (!deleted) {
        return status(404, { message: 'Note not found' })
      }

      return { message: 'Note deleted' }
    },
    {
      detail: {
        tags: ['Notes'],
      },
    },
  )
  .delete(
    '/trash',
    ({ status }) => {
      const storage = useNotesStorage()
      const { deletedCount } = storage.notes.emptyTrash()

      if (!deletedCount) {
        return status(404, { message: 'No notes in trash' })
      }

      return {
        message: `Successfully emptied trash: ${deletedCount} note(s) deleted`,
      }
    },
    {
      detail: {
        tags: ['Notes'],
      },
    },
  )

export default app
