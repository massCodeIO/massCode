import { BrowserWindow } from 'electron'

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
