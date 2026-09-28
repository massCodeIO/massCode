import { BrowserWindow } from 'electron'

export function broadcastNotesAssetReady(fileName: string): void {
  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send('system:notes-asset-ready', fileName)
  })
}
