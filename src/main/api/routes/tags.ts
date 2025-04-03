import type { TagsResponse } from '../dto/tags'
import Elysia from 'elysia'
import { useDB } from '../../db'
import { tagsDTO } from '../dto/tags'

const app = new Elysia({ prefix: '/tags' })

app
  .use(tagsDTO)
  // Получение списка тегов
  .get(
    '/',
    () => {
      const db = useDB()
      const stmt = db.prepare(`SELECT * FROM tags ORDER BY name ASC`)
      const result = stmt.all()

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
      const db = useDB()
      const stmt = db.prepare(
        `INSERT INTO tags (name, createdAt, updatedAt) VALUES (?, ?, ?)`,
      )
      const now = new Date().getTime()

      const { lastInsertRowid } = stmt.run(body.name, now, now)

      return { id: lastInsertRowid as number }
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
    ({ params, error }) => {
      const db = useDB()
      const tag = db
        .prepare(
          `
        SELECT id FROM tags WHERE id = ?
      `,
        )
        .get(params.id)

      if (!tag) {
        return error(404, { message: 'Tag not found' })
      }

      const transaction = db.transaction(() => {
        db.prepare(
          `
        DELETE FROM snippet_tags WHERE tagId = ?
      `,
        ).run(params.id)

        const stmt = db.prepare(`DELETE FROM tags WHERE id = ?`)
        stmt.run(params.id)
      })

      transaction()

      return { message: 'Tag deleted' }
    },
    {
      detail: {
        tags: ['Tags'],
      },
    },
  )

export default app
