import type { TagsResponse } from '../dto/tags'
import Elysia from 'elysia'
import { useDB } from '../../db'
import { tagsDTO } from '../dto/tags'

const app = new Elysia({ prefix: '/tags' })
const db = useDB()

app
  .use(tagsDTO)
  // Получение списка тегов
  .get(
    '/',
    () => {
      const stmt = db.prepare(`SELECT * FROM tags`)
      const result = stmt.all()

      return result as TagsResponse[]
    },
    {
      response: 'tagsResponse[]',
      detail: {
        tags: ['Tags'],
      },
    },
  )
  // Добавление тега
  .post(
    '/',
    ({ body }) => {
      const stmt = db.prepare(
        `INSERT INTO tags (name, createdAt, updatedAt) VALUES (?, ?, ?)`,
      )
      const now = new Date().getTime()

      const { lastInsertRowid } = stmt.run(body.name, now, now)

      return { id: lastInsertRowid }
    },
    {
      body: 'tagsAdd',
      detail: {
        tags: ['Tags'],
      },
    },
  )
  // Удаление тега и удаление его из всех сниппетов
  .delete(
    '/:id',
    ({ params }) => {
      const transaction = db.transaction(() => {
        db.prepare(
          `
        DELETE FROM snippet_tags WHERE tagId = ?
      `,
        ).run(params.id)

        const stmt = db.prepare(`DELETE FROM tags WHERE id = ?`)
        const { changes } = stmt.run(params.id)

        if (!changes) {
          throw new Error('Tag not found')
        }
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
