/* eslint-disable node/prefer-global/process */
import Database from 'better-sqlite3'
import { store } from '../store'

const DB_NAME = 'app.db'
const isDev = process.env.NODE_ENV === 'development'

let db: Database.Database | null = null

export function useDB() {
  if (db)
    return db

  const dbPath = `${store.preferences.get('storagePath')}/${DB_NAME}`

  try {
    db = new Database(dbPath, {
      // eslint-disable-next-line no-console
      verbose: isDev ? console.log : undefined,
    })

    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')

    // Поскольку из коробки в SQLite регистронезависимый поиск возможен только для ASCII,
    // то добавляем самостоятельно функцию для сравнения строк без учета регистра
    db.function('unicode_lower', (str: unknown) => {
      if (typeof str !== 'string')
        return str
      return str.toLowerCase()
    })

    // Таблица для папок
    db.exec(`
      CREATE TABLE IF NOT EXISTS folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        defaultLanguage TEXT NOT NULL,
        parentId INTEGER,
        isOpen INTEGER NOT NULL,
        orderIndex INTEGER NOT NULL DEFAULT 0,
        icon TEXT,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        FOREIGN KEY(parentId) REFERENCES folders(id)
      )
    `)

    // Таблица для сниппетов
    db.exec(`
      CREATE TABLE IF NOT EXISTS snippets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        folderId INTEGER,
        isDeleted INTEGER NOT NULL,
        isFavorites INTEGER NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        FOREIGN KEY(folderId) REFERENCES folders(id)
      )
    `)

    // Таблица для содержимого (фрагментов) сниппетов
    db.exec(`
      CREATE TABLE IF NOT EXISTS snippet_contents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snippetId INTEGER NOT NULL,
        label TEXT,
        value TEXT,
        language TEXT,
        FOREIGN KEY(snippetId) REFERENCES snippets(id)
      )
    `)

    // Таблица для тегов
    db.exec(`
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      )
    `)

    // Таблица для связи сниппетов с тегами (многие ко многим)
    db.exec(`
      CREATE TABLE IF NOT EXISTS snippet_tags (
        snippetId INTEGER NOT NULL,
        tagId INTEGER NOT NULL,
        PRIMARY KEY(snippetId, tagId),
        FOREIGN KEY(snippetId) REFERENCES snippets(id),
        FOREIGN KEY(tagId) REFERENCES tags(id)
      )
    `)

    return db
  }
  catch (error) {
    console.error('Database initialization failed:', error)
    throw error
  }
}
