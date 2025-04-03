import { ipcMain } from 'electron'
import { readFileSync } from 'fs-extra'
import { clearDB, moveDB, reloadDB } from '../../db'
import { migrateJsonToSqlite } from '../../db/migrate'
import { store } from '../../store'

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
}
