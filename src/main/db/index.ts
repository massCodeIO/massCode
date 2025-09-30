/* eslint-disable node/prefer-global/process */
import type { Backup } from './types'
import path from 'node:path'
import Database from 'better-sqlite3'
import { format } from 'date-fns'
import fs from 'fs-extra'
import { store } from '../store'

const DB_NAME = 'massCode.db'
const isDev = process.env.NODE_ENV === 'development'

let db: Database.Database | null = null
let backupTimer: NodeJS.Timeout | null = null

function isSqliteFile(dbPath: string): boolean {
  try {
    if (!fs.existsSync(dbPath))
      return false

    const buffer = fs.readFileSync(dbPath).subarray(0, 16)
    return buffer.toString('ascii') === 'SQLite format 3\x00'
  }
  catch {
    return false
  }
}

function tableExists(db: Database.Database, table: string): boolean {
  const row = db
    .prepare(
      `
    SELECT name 
    FROM sqlite_master 
    WHERE type='table' AND name=?
  `,
    )
    .get(table)
  return !!row
}

export function useDB() {
  if (db)
    return db

  const dbPath = `${store.preferences.get('storagePath')}/${DB_NAME}`

  if (fs.existsSync(dbPath) && !isSqliteFile(dbPath)) {
    const backupPath = `${dbPath}.old`
    try {
      fs.moveSync(dbPath, backupPath)
    }
    catch {}
  }

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

export function reloadDB() {
  try {
    // Закрываем текущую базу данных, если она открыта
    if (db) {
      db.close()
      db = null
      // eslint-disable-next-line no-console
      console.log('Current database has been closed')
    }

    // Определяем путь к новой базе данных
    const dbPath = `${store.preferences.get('storagePath')}/${DB_NAME}`

    // Создаем новое соединение с базой данных
    db = new Database(dbPath, {
      // eslint-disable-next-line no-console
      verbose: isDev ? console.log : undefined,
    })

    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')

    // eslint-disable-next-line no-console
    console.log(`Database successfully reloaded: ${dbPath}`)
  }
  catch (error) {
    console.error('Error while reloading the database:', error)
    throw error
  }
}

export function clearDB() {
  try {
    const db = useDB()
    const stmt = db.transaction(() => {
      const tables = [
        // Таблицы со внешними ключами должны быть первыми
        'snippet_tags',
        'snippet_contents',
        'snippets',
        // Остальные таблицы можно удалить в любом порядке
        'tags',
        'folders',
      ]

      for (const table of tables) {
        if (tableExists(db, table)) {
          db.prepare(`DELETE FROM ${table}`).run()
        }
      }

      // Сброс автоинкремента — тоже только если таблица есть
      if (tableExists(db, 'sqlite_sequence')) {
        db.prepare('DELETE FROM sqlite_sequence').run()
      }
    })

    stmt()
  }
  catch (error) {
    console.error('Error while clearing the database:', error)
    throw error
  }
}

export async function moveDB(path: string) {
  try {
    const currentPath = `${store.preferences.get('storagePath')}/${DB_NAME}`
    const newPath = `${path}/${DB_NAME}`

    const isExists = await fs.exists(newPath)

    if (isExists) {
      throw new Error(`Database already exists at the new path: ${newPath}`)
    }

    if (db) {
      db.close()
      db = null
    }

    await fs.move(currentPath, newPath, { overwrite: true })
    store.preferences.set('storagePath', path)

    reloadDB()
  }
  catch (error) {
    console.error('Error while moving the database:', error)
    throw error
  }
}

export async function createBackup(manual = false) {
  try {
    const db = useDB()
    const backupSettings = store.preferences.get('backup')

    await fs.ensureDir(backupSettings.path)

    const date = format(Date.now(), 'yyyy-MM-dd_HH-mm-ss-SSS')
    const backupFileName = manual
      ? `massCode-manual-backup-${date}.db`
      : `massCode-backup-${date}.db`
    const backupFilePath = path.join(backupSettings.path, backupFileName)

    const stmt = db.prepare(`VACUUM INTO ?`)
    stmt.run(backupFilePath)

    store.preferences.set('backup.lastBackupTime', Date.now())

    await cleanupOldBackups()

    return backupFilePath
  }
  catch (error) {
    console.error('Error creating database backup:', error)
    throw error
  }
}

async function cleanupOldBackups() {
  try {
    const backupSettings = store.preferences.get('backup')

    const files = await fs.readdir(backupSettings.path)
    const backupFiles = files
      .filter(
        file => file.startsWith('massCode-backup-') && file.endsWith('.db'),
      )
      .map(file => ({
        name: file,
        path: path.join(backupSettings.path, file),
        stat: fs.statSync(path.join(backupSettings.path, file)),
      }))
      .sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime())

    if (backupFiles.length > backupSettings.maxBackups) {
      const filesToDelete = backupFiles.slice(backupSettings.maxBackups)

      for (const file of filesToDelete) {
        await fs.remove(file.path)
      }
    }
  }
  catch (error) {
    console.error('Error cleaning up old backups:', error)
  }
}

export async function deleteBackup(backupPath: string) {
  await fs.remove(backupPath)
}

function shouldCreateBackup() {
  const backupSettings = store.preferences.get('backup')

  if (!backupSettings.enabled) {
    return false
  }

  const lastBackupTime = backupSettings.lastBackupTime

  if (!lastBackupTime) {
    return true // Если бекап никогда не создавался
  }

  const now = Date.now()
  const intervalMs = backupSettings.interval * 60 * 60 * 1000 // Конвертируем часы в миллисекунды

  return now - lastBackupTime >= intervalMs
}

export async function startAutoBackup() {
  try {
    if (backupTimer) {
      clearInterval(backupTimer)
    }

    const backupSettings = store.preferences.get('backup')

    if (!backupSettings.enabled) {
      return
    }

    if (shouldCreateBackup()) {
      await createBackup()
    }

    const intervalMs = backupSettings.interval * 60 * 60 * 1000 // Конвертируем часы в миллисекунды

    backupTimer = setInterval(async () => {
      try {
        if (shouldCreateBackup()) {
          await createBackup()
        }
      }
      catch (error) {
        console.error('Error during scheduled backup:', error)
      }
    }, intervalMs)
  }
  catch (error) {
    console.error('Error starting auto backup:', error)
  }
}

export function stopAutoBackup() {
  if (backupTimer) {
    clearInterval(backupTimer)
    backupTimer = null
  }
}

export async function restoreFromBackup(backupFilePath: string) {
  try {
    const storagePath = store.preferences.get('storagePath')
    const currentDbPath = path.join(storagePath, DB_NAME)

    const backupExists = await fs.exists(backupFilePath)

    if (!backupExists) {
      throw new Error(`Backup file does not exist: ${backupFilePath}`)
    }

    if (db) {
      db.close()
      db = null
    }

    await fs.copy(backupFilePath, currentDbPath, { overwrite: true })

    reloadDB()

    console.warn(`Database restored from backup: ${backupFilePath}`)
  }
  catch (error) {
    console.error('Error restoring database from backup:', error)
    throw error
  }
}

export async function getBackupList() {
  try {
    const backupSettings = store.preferences.get('backup')

    if (!(await fs.exists(backupSettings.path))) {
      return []
    }

    const files = await fs.readdir(backupSettings.path)
    const backupFiles: Backup[] = []

    for (const file of files) {
      if (
        file.startsWith('massCode-backup-')
        || (file.startsWith('massCode-manual-backup-') && file.endsWith('.db'))
      ) {
        const filePath = path.join(backupSettings.path, file)
        const stat = await fs.stat(filePath)

        backupFiles.push({
          name: file,
          path: filePath,
          size: stat.size,
          createdAt: stat.mtime,
        })
      }
    }

    return backupFiles.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    )
  }
  catch (error) {
    console.error('Error getting backup list:', error)
    return []
  }
}

export async function moveBackupStorage(newPath: string) {
  try {
    const backupSettings = store.preferences.get('backup')

    const newPathExists = await fs.exists(newPath)

    if (!newPathExists) {
      throw new Error(`Target directory does not exist: ${newPath}`)
    }

    const newPathStat = await fs.stat(newPath)

    if (!newPathStat.isDirectory()) {
      throw new Error(`Target path is not a directory: ${newPath}`)
    }

    const files = await fs.readdir(backupSettings.path)
    const backupFiles = files.filter(
      file =>
        (file.startsWith('massCode-backup-')
          || file.startsWith('massCode-manual-backup-'))
        && file.endsWith('.db'),
    )

    for (const file of backupFiles) {
      const sourcePath = path.join(backupSettings.path, file)
      const targetPath = path.join(newPath, file)

      await fs.move(sourcePath, targetPath, { overwrite: true })
    }

    store.preferences.set('backup.path', newPath)
  }
  catch (error) {
    console.error('Error while moving backup storage:', error)
    throw error
  }
}
