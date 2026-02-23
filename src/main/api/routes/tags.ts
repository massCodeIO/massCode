import type { TagsResponse } from '../dto/tags'
import Elysia from 'elysia'
import { useStorage } from '../../storage'
import { tagsDTO } from '../dto/tags'

const app = new Elysia({ prefix: '/tags' })

app
  .use(tagsDTO)
  // Получение списка тегов
  .get(
    '/',
    () => {
      const storage = useStorage()
      const result = storage.tags.getTags()

      return result as TagsResponse
    },
    {
      response: 'tagsResponse',
      detail: {
        tags: ['Tags'],
      },
    },
  )
  // Добавление тега
  .post(
    '/',
    ({ body }) => {
      const storage = useStorage()
      const { id } = storage.tags.createTag(body.name)

      return { id }
    },
    {
      body: 'tagsAdd',
      response: 'tagsAddResponse',
      detail: {
        tags: ['Tags'],
      },
    },
  )
  // Удаление тега и удаление его из всех сниппетов
  .delete(
    '/:id',
    ({ params, status }) => {
      const storage = useStorage()
      const { deleted } = storage.tags.deleteTag(Number(params.id))

      if (!deleted) {
        return status(404, { message: 'Tag not found' })
      }

      return { message: 'Tag deleted' }
    },
    {
      detail: {
        tags: ['Tags'],
      },
    },
  )

export default app
