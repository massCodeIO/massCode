import type { PreferencesStore } from '../types'
import { homedir, platform } from 'node:os'
import path from 'node:path'
import { app } from 'electron'
import Store from 'electron-store'
import fs from 'fs-extra'
import { EDITOR_DEFAULTS, NOTES_EDITOR_DEFAULTS } from '../constants'

const isWin = platform() === 'win32'

const storagePath = isWin ? `${homedir()}\\massCode` : `${homedir()}/massCode`
const backupPath = isWin ? `${storagePath}\\backups` : `${storagePath}/backups`

// Detect the correct default engine BEFORE the store constructor merges
// defaults into the preferences file. Without this, existing SQLite users
// who never had a `storage.engine` key would get 'markdown' as default,
// making all their snippets invisible.
function detectDefaultEngine(): 'sqlite' | 'markdown' {
  try {
    const prefsPath = path.join(
      app.getPath('userData'),
      'v2',
      'preferences.json',
    )

    if (fs.existsSync(prefsPath)) {
      const raw = JSON.parse(fs.readFileSync(prefsPath, 'utf8'))

      // User already has an explicit engine setting — respect it
      if (raw.storage?.engine) {
        return raw.storage.engine
      }

      // No engine setting — check if SQLite DB exists (existing user)
      const userStoragePath = raw.storagePath || storagePath
      const dbPath = path.join(userStoragePath, 'massCode.db')

      if (fs.existsSync(dbPath)) {
        return 'sqlite'
      }
    }
  }
  catch {
    // If anything goes wrong reading the file, fall through to default
  }

  return 'markdown'
}

const preferencesStore = new Store<PreferencesStore>({
  name: 'preferences',
  cwd: 'v2',

  defaults: {
    storagePath,
    apiPort: 4321,
    language: 'en_US',
    theme: 'auto',
    editor: EDITOR_DEFAULTS,
    notesEditor: NOTES_EDITOR_DEFAULTS,
    storage: {
      engine: detectDefaultEngine(),
      vaultPath: null,
    },
    markdown: {
      scale: 1,
    },
    backup: {
      path: backupPath,
      enabled: true,
      interval: 6,
      maxBackups: 5,
    },
  },
})

export default preferencesStore
