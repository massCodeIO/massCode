import path from 'node:path'
import Database from 'better-sqlite3'
import { app } from 'electron'

export function initDB() {
  try {
    const dbPath = path.join(app.getPath('userData'), 'app-data.db')

    // eslint-disable-next-line no-console
    const db = new Database(dbPath, { verbose: console.log })

    db.pragma('journal_mode = WAL')

    db.transaction(() => {
      db.prepare(
        `
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT
        )
      `,
      ).run()
    })()

    return db
  }
  catch (error) {
    console.error('Database initialization failed:', error)
    throw error
  }
}
