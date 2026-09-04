import type { IpcMainInvokeEvent, WebContents } from 'electron'

function normalizeRendererUrl(value: string): string | null {
  try {
    const url = new URL(value)
    url.hash = ''
    url.search = ''
    return url.toString()
  }
  catch {
    return null
  }
}

export function isTrustedApiSessionTokenRequest(
  event: IpcMainInvokeEvent,
  webContents: WebContents,
  expectedRendererUrl: string,
): boolean {
  const senderFrame = event.senderFrame

  return (
    event.sender === webContents
    && senderFrame !== null
    && senderFrame === webContents.mainFrame
    && normalizeRendererUrl(senderFrame.url)
    === normalizeRendererUrl(expectedRendererUrl)
  )
}

export function registerApiSessionTokenHandler(
  webContents: WebContents,
  expectedRendererUrl: string,
  sessionToken: string,
): void {
  webContents.ipc.handle('system:api-session-token', async (event) => {
    if (
      !isTrustedApiSessionTokenRequest(event, webContents, expectedRendererUrl)
    ) {
      throw new Error('Unauthorized IPC sender')
    }

    return sessionToken
  })
}
