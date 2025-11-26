import type { FoldersResponse, FoldersTree } from '../dto/folders'
import { Elysia } from 'elysia'
import { useDB } from '../../db'
import { commonAddResponse } from '../dto/common/response'
import { foldersDTO } from '../dto/folders'

const app = new Elysia({ prefix: '/folders' })

app
  .use(foldersDTO)
  // Получение списка папок
  .get(
    '/',
    () => {
      const db = useDB()
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
      const db = useDB()
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
      const db = useDB()
      const { name, parentId } = body
      const now = Date.now()

      //  (parentId)
      const { maxOrder } = db
        .prepare(
          `
        SELECT COALESCE(MAX(orderIndex), -1) as maxOrder 
        FROM folders 
        WHERE parentId ${parentId ? '= ?' : 'IS NULL'}
      `,
        )
        .get(...(parentId ? [parentId] : [])) as { maxOrder: number }

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
        parentId ?? null,
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
  .patch(
    '/:id',
    ({ params, body, error }) => {
      const db = useDB()
      const { id } = params
      const now = Date.now()

      const updateFields: string[] = []
      const updateParams: any[] = []
      let needOrderUpdate = false
      let newParentId: number | null | undefined
      let newOrderIndex: number | undefined

      if ('name' in body) {
        updateFields.push('name = ?')
        updateParams.push(body.name)
      }

      if ('icon' in body) {
        updateFields.push('icon = ?')
        updateParams.push(body.icon)
      }

      if ('defaultLanguage' in body) {
        updateFields.push('defaultLanguage = ?')
        updateParams.push(body.defaultLanguage)
      }

      if ('isOpen' in body) {
        updateFields.push('isOpen = ?')
        updateParams.push(body.isOpen)
      }

      if ('parentId' in body) {
        updateFields.push('parentId = ?')
        updateParams.push(body.parentId)
        newParentId = body.parentId
        needOrderUpdate = true
      }

      if ('orderIndex' in body) {
        updateFields.push('orderIndex = ?')
        updateParams.push(body.orderIndex)
        newOrderIndex = body.orderIndex
        needOrderUpdate = true
      }

      if (updateFields.length === 0) {
        return error(400, { message: 'Need at least one field to update' })
      }

      updateFields.push('updatedAt = ?')

      updateParams.push(now)
      updateParams.push(id)

      const transaction = db.transaction(() => {
        // Получаем текущие данные папки
        const folder = db
          .prepare('SELECT parentId, orderIndex FROM folders WHERE id = ?')
          .get(id) as
          | { parentId: number | null, orderIndex: number }
          | undefined

        if (!folder) {
          return error(404, { message: 'Folder not found' })
        }

        // Обновляем порядок, только если изменился родитель или индекс
        if (needOrderUpdate) {
          const currentParentId = folder.parentId
          const currentOrderIndex = folder.orderIndex
          const targetParentId
            = newParentId === undefined ? currentParentId : newParentId
          const targetOrderIndex
            = newOrderIndex === undefined ? currentOrderIndex : newOrderIndex

          if (
            targetParentId !== currentParentId
            || targetOrderIndex !== currentOrderIndex
          ) {
            if (targetParentId === currentParentId) {
              // Перемещение в пределах одного родителя
              if (targetOrderIndex > currentOrderIndex) {
                // Двигаем вниз - уменьшаем индексы папок между старой и новой позицией
                db.prepare(
                  `UPDATE folders
                   SET orderIndex = orderIndex - 1
                   WHERE parentId ${currentParentId === null ? 'IS NULL' : '= ?'}
                   AND orderIndex > ?
                   AND orderIndex <= ?`,
                ).run(
                  ...(currentParentId === null
                    ? [currentOrderIndex, targetOrderIndex]
                    : [currentParentId, currentOrderIndex, targetOrderIndex]),
                )
              }
              else {
                // Двигаем вверх - увеличиваем индексы папок между новой и старой позицией
                db.prepare(
                  `UPDATE folders
                   SET orderIndex = orderIndex + 1
                   WHERE parentId ${currentParentId === null ? 'IS NULL' : '= ?'}
                   AND orderIndex >= ?
                   AND orderIndex < ?`,
                ).run(
                  ...(currentParentId === null
                    ? [targetOrderIndex, currentOrderIndex]
                    : [currentParentId, targetOrderIndex, currentOrderIndex]),
                )
              }
            }
            else {
              // Перемещение между разными родителями
              // 1. Обновляем индексы в старом родителе
              db.prepare(
                `UPDATE folders
                 SET orderIndex = orderIndex - 1
                 WHERE parentId ${currentParentId === null ? 'IS NULL' : '= ?'}
                 AND orderIndex > ?`,
              ).run(
                ...(currentParentId === null
                  ? [currentOrderIndex]
                  : [currentParentId, currentOrderIndex]),
              )

              // 2. Обновляем индексы в новом родителе
              db.prepare(
                `UPDATE folders
                 SET orderIndex = orderIndex + 1
                 WHERE parentId ${targetParentId === null ? 'IS NULL' : '= ?'}
                 AND orderIndex >= ?`,
              ).run(
                ...(targetParentId === null
                  ? [targetOrderIndex]
                  : [targetParentId, targetOrderIndex]),
              )
            }
          }
        }

        // Обновляем саму папку
        const updateStmt = db.prepare(`
          UPDATE folders SET ${updateFields.join(', ')} WHERE id = ?
        `)
        updateStmt.run(...updateParams)
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
    ({ params, error }) => {
      const db = useDB()
      const { id } = params

      const folder = db
        .prepare(
          `
        SELECT id FROM folders WHERE id = ?
      `,
        )
        .get(id)

      if (!folder) {
        return error(404, { message: 'Folder not found' })
      }

      const transaction = db.transaction(() => {
        // Находим все вложенные папки рекурсивно
        const findAllSubfolders = (parentId: number): number[] => {
          // Получаем непосредственные дочерние папки
          const childFolders = db
            .prepare(
              `
            SELECT id FROM folders WHERE parentId = ?
          `,
            )
            .all(parentId) as { id: number }[]

          // Рекурсивно собираем ID всех вложенных папок
          let allSubfolders: number[] = childFolders.map(f => f.id)

          for (const folder of childFolders) {
            allSubfolders = allSubfolders.concat(findAllSubfolders(folder.id))
          }

          return allSubfolders
        }

        // Получаем все вложенные папки
        const subfolderIds = findAllSubfolders(Number(id))
        const allFolderIds = [Number(id), ...subfolderIds]

        // Мягкое удаление сниппетов во всех папках, а также удаляем связь с папками
        db.prepare(
          `
          UPDATE snippets
          SET isDeleted = 1,
              folderId = null
          WHERE folderId IN (${allFolderIds.join(',')})
        `,
        ).run()

        // Удаляем все вложенные папки
        if (subfolderIds.length > 0) {
          db.prepare(
            `
            DELETE FROM folders WHERE id IN (${subfolderIds.join(',')})
          `,
          ).run()
        }

        // Удаляем основную папку
        db.prepare(
          `
          DELETE FROM folders WHERE id = ?
        `,
        ).run(id)
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
