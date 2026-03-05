import type { Backup } from '../../db/types'
import { ipcMain } from 'electron'
import { readFileSync } from 'fs-extra'
import {
  clearDB,
  createBackup,
  deleteBackup,
  getBackupList,
  moveBackupStorage,
  moveDB,
  reloadDB,
  restoreFromBackup,
  startAutoBackup,
  stopAutoBackup,
} from '../../db'
import { migrateJsonToSqlite } from '../../db/migrate'
import {
  migrateMarkdownToSqliteStorage,
  migrateSqliteToMarkdownStorage,
} from '../../storage/providers/markdown'
import { store } from '../../store'
import '../../types'

function assertSqliteEngine(action: string): void {
  const engine = store.preferences.get('storage.engine')

  if (engine !== 'sqlite') {
    throw new Error(`${action} is available only in SQLite storage mode`)
  }
}

export function registerDBHandlers() {
  ipcMain.handle<string, void>('db:relaod', (_, payload) => {
    return new Promise((resolve) => {
      assertSqliteEngine('Database reload')
      store.preferences.set('storagePath', payload)
      reloadDB()
      resolve()
    })
  })

  ipcMain.handle<string, void>('db:move', async (_, payload) => {
    assertSqliteEngine('Database move')
    await moveDB(payload)
  })

  ipcMain.handle<undefined, void>('db:clear', () => {
    return new Promise((resolve) => {
      assertSqliteEngine('Database clear')
      clearDB()
      resolve()
    })
  })

  ipcMain.handle<string, void>('db:migrate', async (_, payload) => {
    assertSqliteEngine('Migration from v3')
    const jsonData = readFileSync(payload, 'utf8')
    await migrateJsonToSqlite(JSON.parse(jsonData))
  })

  ipcMain.handle<
    undefined,
    { folders: number, snippets: number, tags: number }
  >('db:migrate-to-markdown', async () => {
    return migrateSqliteToMarkdownStorage()
  })

  ipcMain.handle<
    undefined,
    { folders: number, snippets: number, tags: number }
  >('db:migrate-to-sqlite', async () => {
    return migrateMarkdownToSqliteStorage()
  })

  ipcMain.handle<boolean, void>('db:backup', async (_, payload) => {
    assertSqliteEngine('Backup')
    await createBackup(payload)
  })

  ipcMain.handle<string, void>('db:restore', async (_, payload) => {
    assertSqliteEngine('Backup restore')
    await restoreFromBackup(payload)
  })

  ipcMain.handle<undefined, Backup[]>('db:backup-list', async () => {
    assertSqliteEngine('Backup list')
    return await getBackupList()
  })

  ipcMain.handle<string, void>('db:delete-backup', async (_, payload) => {
    assertSqliteEngine('Backup delete')
    await deleteBackup(payload)
  })

  ipcMain.handle<string, void>('db:move-backup', async (_, payload) => {
    assertSqliteEngine('Backup move')
    await moveBackupStorage(payload)
  })

  ipcMain.handle('db:start-auto-backup', async () => {
    assertSqliteEngine('Auto backup')
    await startAutoBackup()
  })

  ipcMain.handle('db:stop-auto-backup', async () => {
    stopAutoBackup()
  })
}
