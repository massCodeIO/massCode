// import type Database from 'better-sqlite3'
import type { JSONDB } from './types'
import { clearDB, useDB } from '.'

export function migrateJsonToSqlite(jsonData: JSONDB) {
  return new Promise((resolve, reject) => {
    try {
      const db = useDB()
      clearDB()

      // Подготовленные выражения для вставки данных
      const insertFolderStmt = db.prepare(`
        INSERT INTO folders (name, defaultLanguage, parentId, isOpen, createdAt, updatedAt, icon, orderIndex)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)

      const updateFolderParentStmt = db.prepare(`
        UPDATE folders SET parentId = ? WHERE id = ?
      `)

      const insertTagStmt = db.prepare(`
        INSERT INTO tags (name, createdAt, updatedAt)
        VALUES (?, ?, ?)
      `)

      const insertSnippetStmt = db.prepare(`
        INSERT INTO snippets (name, description, folderId, isDeleted, isFavorites, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)

      const insertSnippetContentStmt = db.prepare(`
        INSERT INTO snippet_contents (snippetId, label, value, language)
        VALUES (?, ?, ?, ?)
      `)

      const insertSnippetTagStmt = db.prepare(`
        INSERT INTO snippet_tags (snippetId, tagId)
        VALUES (?, ?)
      `)

      // Словари для сопоставления оригинальных string id с новыми числовыми id
      const folderIdMap: Record<string, number> = {}
      const tagIdMap: Record<string, number> = {}
      const snippetIdMap: Record<string, number> = {}

      // Транзакция для миграции данных
      const transaction = db.transaction(() => {
        // Миграция папок
        jsonData.folders.forEach((folder) => {
          const result = insertFolderStmt.run(
            folder.name || 'Untitled Folder',
            folder.defaultLanguage || 'plain_text',
            null, // parentId обновим позже
            folder.isOpen ? 1 : 0,
            folder.createdAt || Date.now(),
            folder.updatedAt || Date.now(),
            folder.icon || null,
            folder.index ?? 0,
          )
          folderIdMap[folder.id] = Number(result.lastInsertRowid)
        })

        // Обновляем поле parentId для папок, у которых оно задано
        jsonData.folders.forEach((folder) => {
          if (folder.parentId) {
            const newId = folderIdMap[folder.id]
            const parentNewId = folderIdMap[folder.parentId]
            if (parentNewId) {
              updateFolderParentStmt.run(parentNewId, newId)
            }
          }
        })

        // Миграция тегов
        jsonData.tags.forEach((tag) => {
          const result = insertTagStmt.run(
            tag.name || 'Untitled Tag',
            tag.createdAt || Date.now(),
            tag.updatedAt || Date.now(),
          )
          tagIdMap[tag.id] = Number(result.lastInsertRowid)
        })

        // Миграция сниппетов, их содержимого и связей с тегами
        jsonData.snippets.forEach((snippet) => {
          // Определяем новый id папки для сниппета
          const mappedFolderId = folderIdMap[snippet.folderId] || null
          const result = insertSnippetStmt.run(
            snippet.name || 'Untitled Snippet',
            snippet.description || null,
            mappedFolderId,
            snippet.isDeleted ? 1 : 0,
            snippet.isFavorites ? 1 : 0,
            snippet.createdAt || Date.now(),
            snippet.updatedAt || Date.now(),
          )
          const newSnippetId = Number(result.lastInsertRowid)
          snippetIdMap[snippet.id] = newSnippetId

          // Устанавливаем содержимое сниппета
          snippet.content.forEach((content) => {
            insertSnippetContentStmt.run(
              newSnippetId,
              content.label || null,
              content.value || null,
              content.language || null,
            )
          })

          // Устанавливаем связи сниппета с тегами
          if (snippet.tagsIds && snippet.tagsIds.length > 0) {
            snippet.tagsIds.forEach((tagOrigId) => {
              const mappedTagId = tagIdMap[tagOrigId]
              if (mappedTagId) {
                insertSnippetTagStmt.run(newSnippetId, mappedTagId)
              }
            })
          }
        })
      })

      transaction()
      resolve(true)
    }
    catch (error) {
      reject(error)
    }
  })
}
