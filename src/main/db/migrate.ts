import type Database from 'better-sqlite3'
import type { JSONDB } from './types'

export function migrateJsonToSqlite(jsonData: JSONDB, db: Database.Database) {
  // Подготовленные выражения для вставки данных
  const insertFolderStmt = db.prepare(`
    INSERT INTO folders (name, defaultLanguage, parentId, isOpen, isSystem, createdAt, updatedAt, icon)
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
        folder.name,
        folder.defaultLanguage || null,
        null, // parentId обновим позже
        folder.isOpen ? 1 : 0,
        folder.isSystem ? 1 : 0,
        folder.createdAt,
        folder.updatedAt,
        folder.icon || null,
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
      const result = insertTagStmt.run(tag.name, tag.createdAt, tag.updatedAt)
      tagIdMap[tag.id] = Number(result.lastInsertRowid)
    })

    // Миграция сниппетов, их содержимого и связей с тегами
    jsonData.snippets.forEach((snippet) => {
      // Определяем новый id папки для сниппета
      const mappedFolderId = folderIdMap[snippet.folderId] || null
      const result = insertSnippetStmt.run(
        snippet.name,
        snippet.description || null,
        mappedFolderId,
        snippet.isDeleted ? 1 : 0,
        snippet.isFavorites ? 1 : 0,
        snippet.createdAt,
        snippet.updatedAt,
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
}
