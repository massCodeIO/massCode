import type {
  FolderCreateInput,
  FolderRecord,
  FoldersStorage,
  FolderTreeRecord,
  FolderUpdateInput,
  FolderUpdateResult,
} from '../../contracts'
import { useDB } from '../../../db'

interface FolderOrderSnapshot {
  orderIndex: number
  parentId: number | null
}

export function createSqliteFoldersStorage(): FoldersStorage {
  return {
    getFolders: () => {
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

      return stmt.all() as FolderRecord[]
    },
    getFoldersTree: () => {
      const db = useDB()
      const allFolders = db
        .prepare(
          `
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
            ORDER BY parentId, orderIndex
          `,
        )
        .all() as FolderRecord[]

      const folderMap = new Map<number, FolderTreeRecord>()
      const rootFolders: FolderTreeRecord[] = []

      allFolders.forEach((folder) => {
        folderMap.set(folder.id, {
          ...folder,
          children: [],
        })
      })

      folderMap.forEach((folder) => {
        if (folder.parentId === null) {
          rootFolders.push(folder)
          return
        }

        const parent = folderMap.get(folder.parentId)
        if (parent) {
          parent.children.push(folder)
        }
      })

      return rootFolders
    },
    createFolder: (input: FolderCreateInput) => {
      const db = useDB()
      const { name, parentId } = input
      const now = Date.now()
      const hasParentId = parentId !== undefined && parentId !== null

      const { maxOrder } = db
        .prepare(
          `
            SELECT COALESCE(MAX(orderIndex), -1) as maxOrder
            FROM folders
            WHERE parentId ${hasParentId ? '= ?' : 'IS NULL'}
          `,
        )
        .get(...(hasParentId ? [parentId] : [])) as { maxOrder: number }

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

      return { id: Number(lastInsertRowid) }
    },
    updateFolder: (
      id: number,
      input: FolderUpdateInput,
    ): FolderUpdateResult => {
      const db = useDB()
      const now = Date.now()

      const updateFields: string[] = []
      const updateParams: any[] = []
      let needOrderUpdate = false
      let newParentId: number | null | undefined
      let newOrderIndex: number | undefined

      if ('name' in input) {
        updateFields.push('name = ?')
        updateParams.push(input.name)
      }

      if ('icon' in input) {
        updateFields.push('icon = ?')
        updateParams.push(input.icon ?? null)
      }

      if ('defaultLanguage' in input) {
        updateFields.push('defaultLanguage = ?')
        updateParams.push(input.defaultLanguage)
      }

      if ('isOpen' in input) {
        updateFields.push('isOpen = ?')
        updateParams.push(input.isOpen)
      }

      if ('parentId' in input) {
        updateFields.push('parentId = ?')
        updateParams.push(input.parentId ?? null)
        newParentId = input.parentId
        needOrderUpdate = true
      }

      if ('orderIndex' in input) {
        updateFields.push('orderIndex = ?')
        updateParams.push(input.orderIndex)
        newOrderIndex = input.orderIndex
        needOrderUpdate = true
      }

      if (updateFields.length === 0) {
        return {
          invalidInput: true,
          notFound: false,
        }
      }

      updateFields.push('updatedAt = ?')
      updateParams.push(now)
      updateParams.push(id)

      let isNotFound = false

      const transaction = db.transaction(() => {
        const folder = db
          .prepare('SELECT parentId, orderIndex FROM folders WHERE id = ?')
          .get(id) as FolderOrderSnapshot | undefined

        if (!folder) {
          isNotFound = true
          return
        }

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
              if (targetOrderIndex > currentOrderIndex) {
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

        const updateStmt = db.prepare(`
          UPDATE folders SET ${updateFields.join(', ')} WHERE id = ?
        `)
        updateStmt.run(...updateParams)
      })

      transaction()

      return {
        invalidInput: false,
        notFound: isNotFound,
      }
    },
    deleteFolder: (id: number) => {
      const db = useDB()

      const folder = db
        .prepare(
          `
            SELECT id FROM folders WHERE id = ?
          `,
        )
        .get(id)

      if (!folder) {
        return { deleted: false }
      }

      const transaction = db.transaction(() => {
        const findAllSubfolders = (parentId: number): number[] => {
          const childFolders = db
            .prepare(
              `
                SELECT id FROM folders WHERE parentId = ?
              `,
            )
            .all(parentId) as { id: number }[]

          let allSubfolders: number[] = childFolders.map(folder => folder.id)

          for (const folder of childFolders) {
            allSubfolders = allSubfolders.concat(findAllSubfolders(folder.id))
          }

          return allSubfolders
        }

        const subfolderIds = findAllSubfolders(id)
        const allFolderIds = [id, ...subfolderIds]

        db.prepare(
          `
            UPDATE snippets
            SET isDeleted = 1,
                folderId = null
            WHERE folderId IN (${allFolderIds.join(',')})
          `,
        ).run()

        if (subfolderIds.length > 0) {
          db.prepare(
            `
              DELETE FROM folders WHERE id IN (${subfolderIds.join(',')})
            `,
          ).run()
        }

        db.prepare(
          `
            DELETE FROM folders WHERE id = ?
          `,
        ).run(id)
      })

      transaction()

      return { deleted: true }
    },
  }
}
