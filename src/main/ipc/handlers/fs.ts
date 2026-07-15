import type { ImportMarkdownFolderResponse } from '../../types/ipc'
import { Buffer } from 'node:buffer'
import { randomBytes } from 'node:crypto'
import { extname, join, parse, relative } from 'node:path'
import { BrowserWindow, dialog, ipcMain } from 'electron'
import {
  ensureDirSync,
  lstat,
  readdir,
  readFile,
  realpath,
  writeFileSync,
} from 'fs-extra'
import slash from 'slash'
import {
  getNotesPaths,
  parseNotesAssetWritePayload,
  writeNotesAsset,
} from '../../storage/providers/markdown/notes/runtime'
import { ensureFlatSpacesLayout } from '../../storage/providers/markdown/runtime/spaces'
import { store } from '../../store'

const ASSETS_DIR = 'assets'

// A short, URL- and filesystem-safe id for asset filenames. Uses the
// built-in crypto module so the main process keeps no dependency on the
// ESM-only nanoid, which cannot be `require`d from the compiled CommonJS
// build.
function generateAssetId() {
  return randomBytes(12).toString('base64url')
}

async function readMarkdownFolder(
  rootPath: string,
): Promise<ImportMarkdownFolderResponse> {
  const files: ImportMarkdownFolderResponse['files'] = []
  const warnings: ImportMarkdownFolderResponse['warnings'] = []
  const visitedDirectories = new Set<string>()

  async function visit(dirPath: string) {
    let resolvedDirPath = ''
    let entries: string[] = []

    try {
      resolvedDirPath = await realpath(dirPath)
      if (visitedDirectories.has(resolvedDirPath)) {
        return
      }

      visitedDirectories.add(resolvedDirPath)
      entries = await readdir(dirPath)
    }
    catch {
      warnings.push({
        code: 'fs.folderReadFailed',
        source: slash(relative(rootPath, dirPath)) || '.',
      })
      return
    }

    await Promise.all(
      entries.map(async (entry) => {
        const absolutePath = join(dirPath, entry)
        const relativePath = slash(relative(rootPath, absolutePath))

        try {
          const stat = await lstat(absolutePath)

          if (stat.isSymbolicLink()) {
            return
          }

          if (stat.isDirectory()) {
            await visit(absolutePath)
            return
          }

          if (!stat.isFile() || extname(entry).toLowerCase() !== '.md') {
            return
          }

          files.push({
            content: await readFile(absolutePath, 'utf8'),
            name: entry,
            relativePath,
          })
        }
        catch {
          warnings.push({
            code: 'fs.fileReadFailed',
            source: relativePath,
          })
        }
      }),
    )
  }

  await visit(rootPath)

  return { canceled: false, files, warnings }
}

export function registerFsHandlers() {
  ipcMain.handle('fs:assets', (event, { buffer, fileName }) => {
    const storagePath = store.preferences.get('storage.rootPath') as string

    return new Promise((resolve, reject) => {
      try {
        const assetsPath = join(storagePath, ASSETS_DIR)

        const { ext } = parse(fileName)
        const name = `${generateAssetId()}${ext}`
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

  ipcMain.handle('fs:notes-asset', async (event, payload: unknown) => {
    const parsedPayload = parseNotesAssetWritePayload(payload)
    if (!parsedPayload) {
      throw new TypeError('Invalid Notes asset payload')
    }

    const vaultPath
      = (store.preferences.get('storage.vaultPath') as string | null)
        || join(
          store.preferences.get('storage.rootPath') as string,
          'markdown-vault',
        )

    ensureFlatSpacesLayout(vaultPath)
    return writeNotesAsset(
      getNotesPaths(vaultPath),
      parsedPayload.buffer,
      parsedPayload.ext,
    )
  })

  ipcMain.handle('fs:import-markdown-folder', async () => {
    return new Promise<ImportMarkdownFolderResponse>((resolve) => {
      const window = BrowserWindow.getFocusedWindow()
      if (!window) {
        resolve({ canceled: true, files: [], warnings: [] })
        return
      }

      const result = dialog.showOpenDialogSync(window, {
        properties: ['openDirectory'],
      })

      if (!result?.[0]) {
        resolve({ canceled: true, files: [], warnings: [] })
        return
      }

      resolve(readMarkdownFolder(result[0]))
    })
  })
}
