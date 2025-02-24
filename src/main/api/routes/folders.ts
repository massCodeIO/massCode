import type { FoldersResponse } from '../dto/folders'
import { Elysia } from 'elysia'
import { useDB } from '../../db'
import { commonAddResponse } from '../dto/common/response'
import { foldersDTO } from '../dto/folders'

const app = new Elysia({ prefix: '/folders' })
const db = useDB()

app
  .use(foldersDTO)
  // Получение списка папок
  .get(
    '/',
    () => {
      const stmt = db.prepare(`
      SELECT 
        id,
        name,
        defaultLanguage,
        isOpen,
        createdAt,
        updatedAt,
        icon
      FROM folders
      ORDER BY createdAt DESC
    `)

      const result = stmt.all()

      return result as FoldersResponse
    },
    {
      response: 'foldersResponse',
      detail: {
        tags: ['Folders'],
      },
    },
  )
  // Добавление папки
  .post(
    '/',
    ({ body }) => {
      const { name } = body
      const now = Date.now()

      const stmt = db.prepare(`
        INSERT INTO folders (
          name,
          defaultLanguage,
          isOpen,
          createdAt,
          updatedAt
        ) VALUES (?, ?, ?, ?, ?)
      `)

      const { lastInsertRowid } = stmt.run(name, 'plain_text', 0, now, now)

      return { id: lastInsertRowid }
    },
    {
      body: 'foldersAdd',
      response: commonAddResponse,
      detail: {
        tags: ['Folders'],
      },
    },
  )
  // Обновление папки
  .put(
    '/:id',
    ({ params, body }) => {
      const now = Date.now()
      const { id } = params
      const { name, icon, defaultLanguage, parentId, isOpen } = body

      const stmt = db.prepare(`
        UPDATE folders 
        SET name = ?,
            icon = ?,
            defaultLanguage = ?,
            isOpen = ?,
            parentId = ?,
            updatedAt = ?
        WHERE id = ?
      `)

      const { changes } = stmt.run(
        name,
        icon,
        defaultLanguage,
        isOpen,
        parentId,
        now,
        id,
      )

      if (!changes) {
        throw new Error('Folder not found')
      }

      return { message: 'Folder updated' }
    },
    {
      body: 'foldersUpdate',
      detail: {
        tags: ['Folders'],
      },
    },
  )
  // Удаление папки
  .delete(
    '/:id',
    ({ params }) => {
      const { id } = params
      const transaction = db.transaction(() => {
        // Мягкое удаление сниппетов в папке, а так же удаляем связь с папкой
        db.prepare(
          `
          UPDATE snippets
            SET isDeleted = 1,
                folderId = null
          WHERE folderId = ?
        `,
        ).run(id)

        // Удаляем папку
        const { changes } = db
          .prepare(
            `
          DELETE FROM folders WHERE id = ?
        `,
          )
          .run(id)

        if (!changes) {
          throw new Error('Folder not found')
        }
      })

      transaction()

      return { message: 'Folder deleted' }
    },
    {
      detail: {
        tags: ['Folders'],
      },
    },
  )

export default app
