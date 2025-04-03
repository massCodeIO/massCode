import type { SnippetsCountsResponse, SnippetsResponse } from '../dto/snippets'
import Elysia from 'elysia'
import { useDB } from '../../db'
import { commonAddResponse } from '../dto/common/response'
import { snippetsDTO } from '../dto/snippets'

const app = new Elysia({ prefix: '/snippets' })

app
  .use(snippetsDTO)
  // Получение списка сниппетов c возможностью фильтрации
  .get(
    '/',
    ({ query }) => {
      const db = useDB()
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
  // Получение кол-ва сниппетов
  .get(
    '/counts',
    () => {
      const db = useDB()

      const stmt = db.prepare(`
        SELECT
          COUNT(*) as total,
          COALESCE(SUM(CASE WHEN isDeleted = 1 THEN 1 ELSE 0 END), 0) as trash
        FROM snippets
      `)

      return stmt.get() as SnippetsCountsResponse
    },
    {
      response: 'snippetsCountsResponse',
      detail: {
        tags: ['Snippets'],
      },
    },
  )
  // Создание сниппета
  .post(
    '/',
    ({ body }) => {
      const db = useDB()
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
      const db = useDB()
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
  .patch(
    '/:id',
    ({ params, body, error }) => {
      const db = useDB()
      const { id } = params

      const updateFields: string[] = []
      const updateParams: any[] = []

      if ('name' in body) {
        updateFields.push('name = ?')
        updateParams.push(body.name)
      }

      if ('description' in body) {
        updateFields.push('description = ?')
        updateParams.push(body.description)
      }

      if ('folderId' in body) {
        updateFields.push('folderId = ?')
        updateParams.push(body.folderId)
      }

      if ('isFavorites' in body) {
        updateFields.push('isFavorites = ?')
        updateParams.push(body.isFavorites)
      }

      if ('isDeleted' in body) {
        updateFields.push('isDeleted = ?')
        updateParams.push(body.isDeleted)
      }

      if (updateFields.length === 0) {
        return error(400, { message: 'Need at least one field to update' })
      }

      updateFields.push('updatedAt = ?')

      const now = new Date().getTime()

      updateParams.push(now)
      updateParams.push(id)

      const stmt = db.prepare(`
        UPDATE snippets SET
          ${updateFields.join(', ')}
        WHERE id = ?
      `)

      const result = stmt.run(...updateParams)

      if (!result.changes) {
        return error(404, { message: 'Snippet not found' })
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
  .patch(
    '/:id/contents/:contentId',
    ({ params, body, error }) => {
      const db = useDB()
      const { id, contentId } = params

      const updateFields: string[] = []
      const updateParams: any[] = []

      if ('label' in body) {
        updateFields.push('label = ?')
        updateParams.push(body.label)
      }

      if ('value' in body) {
        updateFields.push('value = ?')
        updateParams.push(body.value)
      }

      if ('language' in body) {
        updateFields.push('language = ?')
        updateParams.push(body.language)
      }

      if (updateFields.length === 0) {
        return error(400, { message: 'Need at least one field to update' })
      }

      updateParams.push(contentId)

      const contentsStmt = db.prepare(`
        UPDATE snippet_contents SET
          ${updateFields.join(', ')}
        WHERE id = ?
      `)

      const contentsResult = contentsStmt.run(...updateParams)

      if (!contentsResult.changes) {
        return error(404, { message: 'Snippet content not found' })
      }

      // Обновляем дату сниппета только если были реальные изменения в данных
      if (contentsResult.changes > 0) {
        const snippetsStmt = db.prepare(`
          UPDATE snippets SET updatedAt = ? WHERE id = ?
        `)

        const now = new Date().getTime()
        const snippetResult = snippetsStmt.run(now, id)

        if (!snippetResult.changes) {
          return error(404, { message: 'Snippet not found' })
        }
      }

      return { message: 'Snippet content updated' }
    },
    {
      body: 'snippetContentsUpdate',
      detail: {
        tags: ['Snippets'],
      },
    },
  )
  // Добавление тега к сниппету
  .post(
    '/:id/tags/:tagId',
    ({ params, error }) => {
      const db = useDB()
      const { id, tagId } = params

      // Проверяем, существует ли сниппет
      const snippet = db
        .prepare(
          `
        SELECT id FROM snippets WHERE id = ?
      `,
        )
        .get(id)

      if (!snippet) {
        return error(404, { message: 'Snippet not found' })
      }

      // Проверяем, существует ли тег
      const tag = db
        .prepare(
          `
        SELECT id FROM tags WHERE id = ?
      `,
        )
        .get(tagId)

      if (!tag) {
        return error(404, { message: 'Tag not found' })
      }

      // Добавляем связь между сниппетом и тегом
      const stmt = db.prepare(
        `
      INSERT INTO snippet_tags (snippetId, tagId)
      VALUES (?, ?)
    `,
      )

      stmt.run(id, tagId)

      return { message: 'Tag added to snippet' }
    },
    {
      detail: {
        tags: ['Snippets'],
      },
    },
  )
  // Удаление тега из сниппета
  .delete(
    '/:id/tags/:tagId',
    ({ params, error }) => {
      const db = useDB()
      const { id, tagId } = params

      // Проверяем, существует ли сниппет
      const snippet = db
        .prepare(
          `
        SELECT id FROM snippets WHERE id = ?
      `,
        )
        .get(id)

      if (!snippet) {
        return error(404, { message: 'Snippet not found' })
      }

      // Проверяем, существует ли тег
      const tag = db
        .prepare(
          `
        SELECT id FROM tags WHERE id = ?
      `,
        )
        .get(tagId)

      if (!tag) {
        return error(404, { message: 'Tag not found' })
      }

      // Удаляем связь между сниппетом и тегом
      const stmt = db.prepare(
        `
      DELETE FROM snippet_tags 
      WHERE snippetId = ? AND tagId = ?
    `,
      )

      const result = stmt.run(id, tagId)

      if (!result.changes) {
        return error(404, {
          message: 'Tag is not associated with this snippet',
        })
      }

      return { message: 'Tag removed from snippet' }
    },
    {
      detail: {
        tags: ['Snippets'],
      },
    },
  )
  // Удаление сниппета
  .delete(
    '/:id',
    ({ params, error }) => {
      const db = useDB()
      const { id } = params

      const snippet = db
        .prepare(
          `
        SELECT id FROM snippets WHERE id = ?
      `,
        )
        .get(id)

      if (!snippet) {
        return error(404, { message: 'Snippet not found' })
      }

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
        db.prepare(
          `
        DELETE FROM snippets WHERE id = ?
      `,
        ).run(id)
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
  // Удаление всех сниппетов в корзине
  .delete(
    '/trash',
    ({ error }) => {
      const db = useDB()
      const deletedSnippets = db
        .prepare(
          `
        SELECT id FROM snippets WHERE isDeleted = 1
      `,
        )
        .all() as { id: number }[]

      if (deletedSnippets.length === 0) {
        return error(404, { message: 'No snippets in trash' })
      }

      const transaction = db.transaction(() => {
        // Удаляем связи с тегами для всех сниппетов из корзины
        db.prepare(
          `
          DELETE FROM snippet_tags 
          WHERE snippetId IN (SELECT id FROM snippets WHERE isDeleted = 1)
        `,
        ).run()

        // Удаляем содержимое всех сниппетов из корзины
        db.prepare(
          `
          DELETE FROM snippet_contents 
          WHERE snippetId IN (SELECT id FROM snippets WHERE isDeleted = 1)
        `,
        ).run()

        // Удаляем сами сниппеты из корзины
        const result = db
          .prepare(
            `
          DELETE FROM snippets WHERE isDeleted = 1
        `,
          )
          .run()

        return result.changes
      })

      const deletedCount = transaction()

      return {
        message: `Successfully emptied trash: ${deletedCount} snippet(s) deleted`,
      }
    },
    {
      detail: {
        tags: ['Snippets'],
      },
    },
  )
  // Удаление содержимого сниппета
  .delete(
    '/:id/contents/:contentId',
    ({ params, error }) => {
      const db = useDB()
      const { contentId } = params

      const result = db
        .prepare(
          `
      DELETE FROM snippet_contents WHERE id = ?
      `,
        )
        .run(contentId)

      if (!result.changes) {
        return error(404, { message: 'Snippet content not found' })
      }

      return { message: 'Snippet content deleted' }
    },
    {
      detail: {
        tags: ['Snippets'],
      },
    },
  )

export default app
