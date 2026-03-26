/* eslint-disable node/prefer-global/process */
import path from 'node:path'
import Database from 'better-sqlite3'
import fs from 'fs-extra'
import { store } from '../store'
import { log } from '../utils'

const DB_NAME = 'massCode.db'
const isDev = process.env.NODE_ENV === 'development'

let db: Database.Database | null = null
let currentDbPath: string | null = null

export function useDB(customDbPath?: string) {
  const dbPath
    = customDbPath || `${store.preferences.get('storagePath')}/${DB_NAME}`

  if (db && currentDbPath === dbPath)
    return db

  if (db) {
    db.close()
    db = null
    currentDbPath = null
  }

  const dbDir = path.dirname(dbPath)

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  try {
    db = new Database(dbPath, {
      // eslint-disable-next-line no-console
      verbose: isDev ? console.log : undefined,
    })
    currentDbPath = dbPath

    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')

    db.function('unicode_lower', (str: unknown) => {
      if (typeof str !== 'string')
        return str
      return str.toLowerCase()
    })

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

    db.exec(`
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      )
    `)

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
    log('Database initialization failed', error)
    throw error
  }
}

export function closeDB() {
  if (db) {
    db.close()
    db = null
    currentDbPath = null
  }
}
