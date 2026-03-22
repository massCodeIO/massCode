import type { NoteTagsResponse } from '../dto/note-tags'
import Elysia from 'elysia'
import { useNotesStorage } from '../../storage'
import { noteTagsDTO } from '../dto/note-tags'

const app = new Elysia({ prefix: '/note-tags' })

app
  .use(noteTagsDTO)
  .get(
    '/',
    () => {
      const storage = useNotesStorage()
      const result = storage.tags.getTags()

      return result as NoteTagsResponse
    },
    {
      response: 'noteTagsResponse',
      detail: {
        tags: ['Note Tags'],
      },
    },
  )
  .post(
    '/',
    ({ body }) => {
      const storage = useNotesStorage()
      const { id } = storage.tags.createTag(body.name)

      return { id }
    },
    {
      body: 'noteTagsAdd',
      response: 'noteTagsAddResponse',
      detail: {
        tags: ['Note Tags'],
      },
    },
  )
  .patch(
    '/:id',
    ({ params, body, status }) => {
      const storage = useNotesStorage()
      const { notFound } = storage.tags.updateTag(Number(params.id), body.name)

      if (notFound) {
        return status(404, { message: 'Tag not found' })
      }

      return { message: 'Tag updated' }
    },
    {
      body: 'noteTagsUpdate',
      detail: {
        tags: ['Note Tags'],
      },
    },
  )
  .delete(
    '/:id',
    ({ params, status }) => {
      const storage = useNotesStorage()
      const { deleted } = storage.tags.deleteTag(Number(params.id))

      if (!deleted) {
        return status(404, { message: 'Tag not found' })
      }

      return { message: 'Tag deleted' }
    },
    {
      detail: {
        tags: ['Note Tags'],
      },
    },
  )

export default app
