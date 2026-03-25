import { BrowserWindow } from 'electron'
import fs from 'fs-extra'

export function log(context: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined

  console.error(`[${context}] ${message}`, error)

  BrowserWindow.getFocusedWindow()?.webContents.send('system:error', {
    context,
    message,
    stack,
  })
}

export function importEsm(specifier: string) {
  // eslint-disable-next-line no-new-func
  return new Function('s', 'return import(s)')(specifier) as Promise<any>
}

export function isSqliteFile(dbPath: string): boolean {
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
