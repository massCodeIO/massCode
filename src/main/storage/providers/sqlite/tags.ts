import type { TagRecord, TagsStorage } from '../../contracts'
import { useDB } from '../../../db'

export function createSqliteTagsStorage(): TagsStorage {
  return {
    getTags: () => {
      const db = useDB()
      const stmt = db.prepare(`
        SELECT id, name
        FROM tags
        ORDER BY name ASC
      `)

      return stmt.all() as TagRecord[]
    },
    createTag: (name) => {
      const db = useDB()
      const stmt = db.prepare(
        `INSERT INTO tags (name, createdAt, updatedAt) VALUES (?, ?, ?)`,
      )
      const now = Date.now()

      const { lastInsertRowid } = stmt.run(name, now, now)

      return { id: Number(lastInsertRowid) }
    },
    deleteTag: (id) => {
      const db = useDB()

      const tag = db
        .prepare(
          `
          SELECT id FROM tags WHERE id = ?
        `,
        )
        .get(id)

      if (!tag) {
        return { deleted: false }
      }

      const transaction = db.transaction(() => {
        db.prepare(
          `
          DELETE FROM snippet_tags WHERE tagId = ?
        `,
        ).run(id)

        const stmt = db.prepare(`DELETE FROM tags WHERE id = ?`)
        stmt.run(id)
      })

      transaction()

      return { deleted: true }
    },
  }
}
