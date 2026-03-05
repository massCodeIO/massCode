import type {
  SnippetContentCreateInput,
  SnippetContentUpdateInput,
  SnippetContentUpdateResult,
  SnippetRecord,
  SnippetsCount,
  SnippetsQueryInput,
  SnippetsStorage,
  SnippetTagDeleteRelationResult,
  SnippetTagRelationResult,
  SnippetUpdateInput,
  SnippetUpdateResult,
} from '../../contracts'
import { useDB } from '../../../db'

interface SnippetRow {
  id: number
  name: string
  description: string | null
  tags: string
  folder: string | null
  contents: string
  isFavorites: number
  isDeleted: number
  createdAt: number
  updatedAt: number
}

export function createSqliteSnippetsStorage(): SnippetsStorage {
  return {
    getSnippets: (query: SnippetsQueryInput) => {
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

      const WHERE: string[] = []
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

      const rows = stmt.all(...params) as SnippetRow[]

      const result = rows.map((snippet) => {
        return {
          id: snippet.id,
          name: snippet.name,
          description: snippet.description,
          tags: JSON.parse(snippet.tags) as SnippetRecord['tags'],
          folder: JSON.parse(
            snippet.folder as unknown as string,
          ) as SnippetRecord['folder'],
          contents: JSON.parse(snippet.contents) as SnippetRecord['contents'],
          isFavorites: snippet.isFavorites,
          isDeleted: snippet.isDeleted,
          createdAt: snippet.createdAt,
          updatedAt: snippet.updatedAt,
        }
      })

      return result
    },
    getSnippetsCounts: () => {
      const db = useDB()

      const stmt = db.prepare(`
        SELECT
          COUNT(*) as total,
          COALESCE(SUM(CASE WHEN isDeleted = 1 THEN 1 ELSE 0 END), 0) as trash
        FROM snippets
      `)

      return stmt.get() as SnippetsCount
    },
    createSnippet: (input) => {
      const db = useDB()
      const { name, folderId } = input

      const stmt = db.prepare(`
        INSERT INTO snippets (name, description, folderId, isDeleted, isFavorites, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)

      const now = Date.now()

      const { lastInsertRowid } = stmt.run(
        name,
        null,
        folderId,
        0,
        0,
        now,
        now,
      )

      return { id: Number(lastInsertRowid) }
    },
    createSnippetContent: (snippetId, input: SnippetContentCreateInput) => {
      const db = useDB()
      const { label, value, language } = input

      const stmt = db.prepare(`
        INSERT INTO snippet_contents (snippetId, label, value, language)
        VALUES (?, ?, ?, ?)
      `)

      const { lastInsertRowid } = stmt.run(
        snippetId,
        label,
        value || null,
        language,
      )

      return { id: Number(lastInsertRowid) }
    },
    updateSnippet: (id, input: SnippetUpdateInput): SnippetUpdateResult => {
      const db = useDB()

      const updateFields: string[] = []
      const updateParams: any[] = []

      if ('name' in input) {
        updateFields.push('name = ?')
        updateParams.push(input.name)
      }

      if ('description' in input) {
        updateFields.push('description = ?')
        updateParams.push(input.description)
      }

      if ('folderId' in input) {
        updateFields.push('folderId = ?')
        updateParams.push(input.folderId)
      }

      if ('isFavorites' in input) {
        updateFields.push('isFavorites = ?')
        updateParams.push(input.isFavorites)
      }

      if ('isDeleted' in input) {
        updateFields.push('isDeleted = ?')
        updateParams.push(input.isDeleted)
      }

      if (updateFields.length === 0) {
        return {
          invalidInput: true,
          notFound: false,
        }
      }

      updateFields.push('updatedAt = ?')
      updateParams.push(Date.now())
      updateParams.push(id)

      const stmt = db.prepare(`
        UPDATE snippets SET
          ${updateFields.join(', ')}
        WHERE id = ?
      `)

      const result = stmt.run(...updateParams)

      return {
        invalidInput: false,
        notFound: !result.changes,
      }
    },
    updateSnippetContent: (
      snippetId,
      contentId,
      input: SnippetContentUpdateInput,
    ): SnippetContentUpdateResult => {
      const db = useDB()

      const updateFields: string[] = []
      const updateParams: any[] = []

      if ('label' in input) {
        updateFields.push('label = ?')
        updateParams.push(input.label)
      }

      if ('value' in input) {
        updateFields.push('value = ?')
        updateParams.push(input.value)
      }

      if ('language' in input) {
        updateFields.push('language = ?')
        updateParams.push(input.language)
      }

      if (updateFields.length === 0) {
        return {
          invalidInput: true,
          notFound: false,
          parentNotFound: false,
        }
      }

      updateParams.push(contentId)

      const contentsStmt = db.prepare(`
        UPDATE snippet_contents SET
          ${updateFields.join(', ')}
        WHERE id = ?
      `)

      const contentsResult = contentsStmt.run(...updateParams)

      if (!contentsResult.changes) {
        return {
          invalidInput: false,
          notFound: true,
          parentNotFound: false,
        }
      }

      const snippetsStmt = db.prepare(`
        UPDATE snippets SET updatedAt = ? WHERE id = ?
      `)

      const snippetResult = snippetsStmt.run(Date.now(), snippetId)

      return {
        invalidInput: false,
        notFound: false,
        parentNotFound: !snippetResult.changes,
      }
    },
    addTagToSnippet: (snippetId, tagId): SnippetTagRelationResult => {
      const db = useDB()
      const snippet = db
        .prepare(
          `
            SELECT id FROM snippets WHERE id = ?
          `,
        )
        .get(snippetId)

      if (!snippet) {
        return {
          notFound: false,
          snippetFound: false,
          tagFound: true,
        }
      }

      const tag = db
        .prepare(
          `
            SELECT id FROM tags WHERE id = ?
          `,
        )
        .get(tagId)

      if (!tag) {
        return {
          notFound: false,
          snippetFound: true,
          tagFound: false,
        }
      }

      const stmt = db.prepare(
        `
          INSERT INTO snippet_tags (snippetId, tagId)
          VALUES (?, ?)
        `,
      )

      stmt.run(snippetId, tagId)

      return {
        notFound: false,
        snippetFound: true,
        tagFound: true,
      }
    },
    deleteTagFromSnippet: (
      snippetId,
      tagId,
    ): SnippetTagDeleteRelationResult => {
      const db = useDB()
      const snippet = db
        .prepare(
          `
            SELECT id FROM snippets WHERE id = ?
          `,
        )
        .get(snippetId)

      if (!snippet) {
        return {
          notFound: false,
          snippetFound: false,
          tagFound: true,
          relationFound: true,
        }
      }

      const tag = db
        .prepare(
          `
            SELECT id FROM tags WHERE id = ?
          `,
        )
        .get(tagId)

      if (!tag) {
        return {
          notFound: false,
          snippetFound: true,
          tagFound: false,
          relationFound: true,
        }
      }

      const stmt = db.prepare(
        `
          DELETE FROM snippet_tags
          WHERE snippetId = ? AND tagId = ?
        `,
      )

      const result = stmt.run(snippetId, tagId)

      return {
        notFound: false,
        snippetFound: true,
        tagFound: true,
        relationFound: !!result.changes,
      }
    },
    deleteSnippet: (id) => {
      const db = useDB()
      const snippet = db
        .prepare(
          `
            SELECT id FROM snippets WHERE id = ?
          `,
        )
        .get(id)

      if (!snippet) {
        return { deleted: false }
      }

      const transaction = db.transaction(() => {
        db.prepare(
          `
            DELETE FROM snippet_tags WHERE snippetId = ?
          `,
        ).run(id)

        db.prepare(
          `
            DELETE FROM snippet_contents WHERE snippetId = ?
          `,
        ).run(id)

        db.prepare(
          `
            DELETE FROM snippets WHERE id = ?
          `,
        ).run(id)
      })

      transaction()

      return { deleted: true }
    },
    emptyTrash: () => {
      const db = useDB()
      const deletedSnippets = db
        .prepare(
          `
            SELECT id FROM snippets WHERE isDeleted = 1
          `,
        )
        .all() as { id: number }[]

      if (deletedSnippets.length === 0) {
        return { deletedCount: 0 }
      }

      const transaction = db.transaction(() => {
        db.prepare(
          `
            DELETE FROM snippet_tags
            WHERE snippetId IN (SELECT id FROM snippets WHERE isDeleted = 1)
          `,
        ).run()

        db.prepare(
          `
            DELETE FROM snippet_contents
            WHERE snippetId IN (SELECT id FROM snippets WHERE isDeleted = 1)
          `,
        ).run()

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

      return { deletedCount }
    },
    deleteSnippetContent: (contentId) => {
      const db = useDB()

      const result = db
        .prepare(
          `
            DELETE FROM snippet_contents WHERE id = ?
          `,
        )
        .run(contentId)

      return { deleted: !!result.changes }
    },
  }
}
