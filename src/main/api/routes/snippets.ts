import type { SnippetsResponse } from '../dto/snippets'
import Elysia from 'elysia'
import { useDB } from '../../db'
import { commonAddResponse } from '../dto/common/response'
import { snippetsDTO } from '../dto/snippets'

const app = new Elysia({ prefix: '/snippets' })
const db = useDB()

app
  .use(snippetsDTO)
  // Получение списка сниппетов c возможностью фильтрации
  .get(
    '/',
    ({ query }) => {
      const {
        search,
        order,
        folderId,
        tagId,
        isFavorites,
        isDeleted,
        isInbox,
      } = query
      const searchQuery = search ? `%${query.search}%` : undefined

      const WHERE: any[] = []
      const ORDER = order || 'DESC'
      const params: any[] = []

      if (searchQuery) {
        WHERE.push(`(
        unicode_lower(s.name) LIKE unicode_lower(?) OR
        unicode_lower(s.description) LIKE unicode_lower(?) OR
        EXISTS (
          SELECT 1 FROM snippet_contents sc 
          WHERE sc.snippetId = s.id AND unicode_lower(sc.value) LIKE unicode_lower(?)
        )
      )`)
        params.push(searchQuery, searchQuery, searchQuery)
      }

      if (folderId) {
        WHERE.push('s.folderId = ?')
        params.push(folderId)
      }
      else if (isInbox) {
        WHERE.push('s.folderId IS NULL')
      }

      if (tagId) {
        WHERE.push(
          'EXISTS (SELECT 1 FROM snippet_tags st2 WHERE st2.snippetId = s.id AND st2.tagId = ?)',
        )
        params.push(tagId)
      }

      if (isFavorites) {
        WHERE.push('s.isFavorites = 1')
      }

      if (isDeleted) {
        WHERE.push('s.isDeleted = 1')
      }
      else {
        WHERE.push('s.isDeleted = 0')
      }

      const whereCondition = WHERE.length ? `WHERE ${WHERE.join(' AND ')}` : ''

      const stmt = db.prepare(`
      WITH snippet_contents_data AS (
        SELECT 
          snippetId,
          json_group_array(
            json_object(
              'id', id,
              'label', label,
              'value', value,
              'language', language
            )
          ) as contents
        FROM snippet_contents
        GROUP BY snippetId
      ),
      snippet_data AS (
        SELECT 
          s.id,
          s.name,
          s.description,
          s.isFavorites,
          s.isDeleted,
          s.createdAt,
          s.updatedAt,
          CASE 
            WHEN f.id IS NOT NULL THEN json_object(
              'id', f.id,
              'name', f.name
            )
            ELSE NULL
          END as folder,
          json_group_array(
            json_object(
              'id', t.id,
              'name', t.name
            )
          ) FILTER (WHERE t.id IS NOT NULL) as tags,
          COALESCE(scd.contents, '[]') as contents
        FROM snippets s
        LEFT JOIN folders f ON s.folderId = f.id
        LEFT JOIN snippet_tags st ON s.id = st.snippetId
        LEFT JOIN tags t ON st.tagId = t.id
        LEFT JOIN snippet_contents_data scd ON s.id = scd.snippetId
        ${whereCondition}
        GROUP BY s.id
      )
      SELECT 
        id,
        name,
        description,
        isFavorites,
        isDeleted,
        folder,
        tags,
        contents,
        createdAt,
        updatedAt
      FROM snippet_data
      ORDER BY createdAt ${ORDER}
    `)

      const result = stmt.all(...params) as SnippetsResponse

      result.forEach((snippet) => {
        snippet.contents = JSON.parse(snippet.contents as unknown as string)
        snippet.tags = JSON.parse(snippet.tags as unknown as string)
        snippet.folder = JSON.parse(snippet.folder as unknown as string)
      })

      return result
    },
    {
      query: 'snippetsQuery',
      response: 'snippetsResponse',
      detail: {
        tags: ['Snippets'],
      },
    },
  )
  // Создание сниппета
  .post(
    '/',
    ({ body }) => {
      const { name, folderId } = body

      const stmt = db.prepare(`
      INSERT INTO snippets (name, description, folderId, isDeleted, isFavorites, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

      const now = new Date().getTime()

      const { lastInsertRowid } = stmt.run(
        name,
        null,
        folderId,
        0,
        0,
        now,
        now,
      )

      return { id: lastInsertRowid }
    },
    {
      body: 'snippetsAdd',
      response: commonAddResponse,
      detail: {
        tags: ['Snippets'],
      },
    },
  )
  // Добавление содержимого сниппета
  .post(
    '/:id/contents',
    ({ params, body }) => {
      const { id } = params
      const { label, value, language } = body

      const stmt = db.prepare(`
      INSERT INTO snippet_contents (snippetId, label, value, language)
      VALUES (?, ?, ?, ?)
    `)

      const result = stmt.run(id, label, value || null, language)

      return { id: result.lastInsertRowid }
    },
    {
      body: 'snippetContentsAdd',
      response: commonAddResponse,
      detail: {
        tags: ['Snippets'],
      },
    },
  )
  // Обновление сниппета
  .put(
    '/:id',
    ({ params, body, set }) => {
      const { id } = params
      const { name, description, folderId, isFavorites, isDeleted } = body

      const stmt = db.prepare(`
      UPDATE snippets SET
        name = ?,
        description = ?,
        folderId = ?,
        isFavorites = ?,
        isDeleted = ?,
        updatedAt = ?
      WHERE id = ?
    `)

      const now = new Date().getTime()

      const result = stmt.run(
        name,
        description,
        folderId,
        isFavorites,
        isDeleted,
        now,
        id,
      )

      if (!result.changes) {
        set.status = 404
        throw new Error('Snippet not found')
      }

      return { message: 'Snippet updated' }
    },
    {
      body: 'snippetsUpdate',
      detail: {
        tags: ['Snippets'],
      },
    },
  )
  // Обновление содержимого сниппета
  .put(
    '/:id/contents/:contentId',
    ({ params, body, set }) => {
      const { id, contentId } = params
      const { label, value, language } = body

      // обновляем updateAt для сниппета
      const snippetsStmt = db.prepare(`
      UPDATE snippets SET updatedAt = ? WHERE id = ?
    `)

      const now = new Date().getTime()
      const snippetResult = snippetsStmt.run(now, id)

      if (!snippetResult.changes) {
        set.status = 404
        throw new Error('Snippet not found')
      }

      const contentsStmt = db.prepare(`
      UPDATE snippet_contents SET
        label = ?,
        value = ?,
        language = ?
      WHERE id = ?
    `)

      const contentsResult = contentsStmt.run(
        label,
        value,
        language,
        contentId,
      )

      if (!contentsResult.changes) {
        set.status = 404
        throw new Error('Snippet content not found')
      }

      return { message: 'Snippet content updated' }
    },
    {
      body: 'snippetContentsAdd',
      detail: {
        tags: ['Snippets'],
      },
    },
  )
  // Удаление сниппета
  .delete(
    '/:id',
    ({ params, set }) => {
      const { id } = params

      const transaction = db.transaction(() => {
        // Удаляем связи с тегами
        db.prepare(
          `
        DELETE FROM snippet_tags WHERE snippetId = ?
      `,
        ).run(id)

        // Удаляем содержимое сниппета
        db.prepare(
          `
        DELETE FROM snippet_contents WHERE snippetId = ?
      `,
        ).run(id)

        // Удаляем сам сниппет
        const result = db
          .prepare(
            `
        DELETE FROM snippets WHERE id = ?
      `,
          )
          .run(id)

        if (!result.changes) {
          set.status = 404
          throw new Error('Snippet not found')
        }
      })

      transaction()
      return { message: 'Snippet deleted' }
    },
    {
      detail: {
        tags: ['Snippets'],
      },
    },
  )

export default app
