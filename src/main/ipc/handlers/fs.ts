import type { ImportMarkdownFolderResponse } from '../../types/ipc'
import { Buffer } from 'node:buffer'
import { extname, join, parse, relative } from 'node:path'
import { BrowserWindow, dialog, ipcMain } from 'electron'
import {
  ensureDirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'fs-extra'
import { nanoid } from 'nanoid'
import slash from 'slash'
import { ensureFlatSpacesLayout } from '../../storage/providers/markdown/runtime/spaces'
import { store } from '../../store'

const ASSETS_DIR = 'assets'

function readMarkdownFolder(rootPath: string): ImportMarkdownFolderResponse {
  const files: ImportMarkdownFolderResponse['files'] = []
  const warnings: ImportMarkdownFolderResponse['warnings'] = []

  function visit(dirPath: string) {
    let entries: string[] = []

    try {
      entries = readdirSync(dirPath)
    }
    catch {
      warnings.push({
        message:
          'Folder could not be read. Check file permissions and iCloud download status.',
        source: slash(relative(rootPath, dirPath)) || '.',
      })
      return
    }

    entries.forEach((entry) => {
      const absolutePath = join(dirPath, entry)
      const relativePath = slash(relative(rootPath, absolutePath))

      try {
        const stat = statSync(absolutePath)

        if (stat.isDirectory()) {
          visit(absolutePath)
          return
        }

        if (!stat.isFile() || extname(entry).toLowerCase() !== '.md') {
          return
        }

        files.push({
          content: readFileSync(absolutePath, 'utf8'),
          name: entry,
          relativePath,
        })
      }
      catch {
        warnings.push({
          message:
            'File could not be read. Check file permissions and iCloud download status.',
          source: relativePath,
        })
      }
    })
  }

  visit(rootPath)

  return { canceled: false, files, warnings }
}

export function registerFsHandlers() {
  ipcMain.handle('fs:assets', (event, { buffer, fileName }) => {
    const storagePath = store.preferences.get('storage.rootPath') as string

    return new Promise((resolve, reject) => {
      try {
        const assetsPath = join(storagePath, ASSETS_DIR)

        const { ext } = parse(fileName)
        const name = `${nanoid()}${ext}`
        const dest = join(assetsPath, name)

        ensureDirSync(assetsPath)
        writeFileSync(dest, Buffer.from(buffer))

        resolve(slash(join(ASSETS_DIR, name)))
      }
      catch (error) {
        reject(error)
      }
    })
  })

  ipcMain.handle('fs:notes-asset', (event, { buffer, ext }) => {
    const vaultPath
      = (store.preferences.get('storage.vaultPath') as string | null)
        || join(
          store.preferences.get('storage.rootPath') as string,
          'markdown-vault',
        )

    return new Promise((resolve, reject) => {
      try {
        ensureFlatSpacesLayout(vaultPath)
        const assetsPath = join(vaultPath, 'notes', 'assets')
        const name = `${nanoid()}${ext}`
        const dest = join(assetsPath, name)

        ensureDirSync(assetsPath)
        writeFileSync(dest, Buffer.from(buffer))

        resolve(`masscode://notes-asset/${name}`)
      }
      catch (error) {
        reject(error)
      }
    })
  })

  ipcMain.handle('fs:import-markdown-folder', () => {
    return new Promise<ImportMarkdownFolderResponse>((resolve) => {
      const result = dialog.showOpenDialogSync(
        BrowserWindow.getFocusedWindow()!,
        {
          properties: ['openDirectory'],
        },
      )

      if (!result?.[0]) {
        resolve({ canceled: true, files: [], warnings: [] })
        return
      }

      resolve(readMarkdownFolder(result[0]))
    })
  })
}
