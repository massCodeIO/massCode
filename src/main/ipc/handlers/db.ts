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
import { store } from '../../store'
import '../../types'

export function registerDBHandlers() {
  ipcMain.handle<string, void>('db:relaod', (_, payload) => {
    return new Promise((resolve) => {
      store.preferences.set('storagePath', payload)
      reloadDB()
      resolve()
    })
  })

  ipcMain.handle<string, void>('db:move', async (_, payload) => {
    await moveDB(payload)
  })

  ipcMain.handle<undefined, void>('db:clear', () => {
    return new Promise((resolve) => {
      clearDB()
      resolve()
    })
  })

  ipcMain.handle<string, void>('db:migrate', async (_, payload) => {
    const jsonData = readFileSync(payload, 'utf8')
    await migrateJsonToSqlite(JSON.parse(jsonData))
  })

  ipcMain.handle<boolean, void>('db:backup', async (_, payload) => {
    await createBackup(payload)
  })

  ipcMain.handle<string, void>('db:restore', async (_, payload) => {
    await restoreFromBackup(payload)
  })

  ipcMain.handle<undefined, Backup[]>('db:backup-list', async () => {
    return await getBackupList()
  })

  ipcMain.handle<string, void>('db:delete-backup', async (_, payload) => {
    await deleteBackup(payload)
  })

  ipcMain.handle<string, void>('db:move-backup', async (_, payload) => {
    await moveBackupStorage(payload)
  })

  ipcMain.handle('db:start-auto-backup', async () => {
    await startAutoBackup()
  })

  ipcMain.handle('db:stop-auto-backup', async () => {
    stopAutoBackup()
  })
}
