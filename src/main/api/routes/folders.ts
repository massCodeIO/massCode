import type { FoldersResponse, FoldersTree } from '../dto/folders'
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
        parentId,
        orderIndex,
        isOpen,
        icon,
        createdAt,
        updatedAt
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
  // Получение папок в виде древовидной структуры
  .get(
    '/tree',
    () => {
      const allFolders = db
        .prepare(
          `
        SELECT * 
        FROM folders
        ORDER BY parentId, orderIndex
      `,
        )
        .all() as FoldersTree

      // Создаем карту для быстрого доступа к папкам по id
      const folderMap = new Map()

      allFolders.forEach((folder) => {
        folder.children = []
        folderMap.set(folder.id, folder)
      })

      const rootFolders: FoldersTree = []

      allFolders.forEach((folder) => {
        if (folder.parentId === null) {
          rootFolders.push(folder)
        }
        else {
          const parent = folderMap.get(folder.parentId)
          if (parent) {
            parent.children.push(folder)
          }
        }
      })

      return rootFolders
    },
    {
      response: 'foldersTreeResponse',
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

      const { maxOrder } = db
        .prepare(
          `
        SELECT COALESCE(MAX(orderIndex), -1) as maxOrder 
        FROM folders 
        WHERE parentId IS NULL 
      `,
        )
        .get() as { maxOrder: number }

      const newOrder = maxOrder + 1

      const stmt = db.prepare(`
        INSERT INTO folders (
          name,
          defaultLanguage,
          parentId,
          isOpen,
          createdAt,
          updatedAt,
          orderIndex
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `)

      const { lastInsertRowid } = stmt.run(
        name,
        'plain_text',
        null,
        0,
        now,
        now,
        newOrder,
      )

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
      const { name, icon, defaultLanguage, parentId, isOpen, orderIndex }
        = body

      const transaction = db.transaction(() => {
        // Получаем текущую папку
        const currentFolder = db
          .prepare(
            `
          SELECT parentId, orderIndex
          FROM folders
          WHERE id = ?
        `,
          )
          .get(id) as { parentId: number | null, orderIndex: number }

        if (!currentFolder) {
          throw new Error('Folder not found')
        }

        // Если изменился родитель или позиция
        if (
          parentId !== currentFolder.parentId
          || orderIndex !== currentFolder.orderIndex
        ) {
          if (parentId === currentFolder.parentId) {
            // Перемещение в пределах одного родителя
            if (orderIndex > currentFolder.orderIndex) {
              // Двигаем вниз - уменьшаем индексы папок между старой и новой позицией
              db.prepare(
                `
                UPDATE folders
                SET orderIndex = orderIndex - 1
                WHERE parentId ${currentFolder.parentId === null ? 'IS NULL' : '= ?'}
                AND orderIndex > ?
                AND orderIndex <= ?
              `,
              ).run(
                ...(currentFolder.parentId === null
                  ? [currentFolder.orderIndex, orderIndex]
                  : [
                      currentFolder.parentId,
                      currentFolder.orderIndex,
                      orderIndex,
                    ]),
              )
            }
            else {
              // Двигаем вверх - увеличиваем индексы папок между новой и старой позицией
              db.prepare(
                `
                UPDATE folders
                SET orderIndex = orderIndex + 1
                WHERE parentId ${currentFolder.parentId === null ? 'IS NULL' : '= ?'}
                AND orderIndex >= ?
                AND orderIndex < ?
              `,
              ).run(
                ...(currentFolder.parentId === null
                  ? [orderIndex, currentFolder.orderIndex]
                  : [
                      currentFolder.parentId,
                      orderIndex,
                      currentFolder.orderIndex,
                    ]),
              )
            }
          }
          else {
            // Перемещение между разными родителями
            // 1. Обновляем индексы в старом родителе
            db.prepare(
              `
              UPDATE folders
              SET orderIndex = orderIndex - 1
              WHERE parentId ${currentFolder.parentId === null ? 'IS NULL' : '= ?'}
              AND orderIndex > ?
            `,
            ).run(
              ...(currentFolder.parentId === null
                ? [currentFolder.orderIndex]
                : [currentFolder.parentId, currentFolder.orderIndex]),
            )

            // 2. Обновляем индексы в новом родителе
            db.prepare(
              `
              UPDATE folders
              SET orderIndex = orderIndex + 1
              WHERE parentId ${parentId === null ? 'IS NULL' : '= ?'}
              AND orderIndex >= ?
            `,
            ).run(
              ...(parentId === null ? [orderIndex] : [parentId, orderIndex]),
            )
          }
        }

        // Обновляем саму папку
        const { changes } = db
          .prepare(
            `
          UPDATE folders 
          SET name = ?,
              icon = ?,
              defaultLanguage = ?,
              isOpen = ?,
              parentId = ?,
              orderIndex = ?,
              updatedAt = ?
          WHERE id = ?
        `,
          )
          .run(
            name,
            icon,
            defaultLanguage,
            isOpen,
            parentId,
            orderIndex,
            now,
            id,
          )

        if (!changes) {
          throw new Error('Folder not found')
        }
      })

      transaction()

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
