import type { CallToolResult } from '@modelcontextprotocol/server'
import { Buffer } from 'node:buffer'
import { BrowserWindow } from 'electron'

export const CONTENT_LIMIT = 256 * 1024
export const RESULT_LIMIT = 2 * 1024 * 1024
export function failure(
  code: string,
  message: string,
  retryable = false,
  extra = {},
): CallToolResult {
  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: JSON.stringify({ code, message, retryable, ...extra }),
      },
    ],
  }
}

export function result(
  value: unknown,
  oversizedMessage = 'Result JSON exceeds the 2 MiB limit.',
): CallToolResult {
  const text = JSON.stringify(value)
  if (Buffer.byteLength(text, 'utf8') > RESULT_LIMIT) {
    return failure('CONTENT_TOO_LARGE', oversizedMessage)
  }
  return { content: [{ type: 'text', text }] }
}

export function storageFailure(error: unknown): CallToolResult {
  const code = error instanceof Error ? error.message.split(':')[0] : ''
  switch (code) {
    case 'CONTENT_TOO_LARGE':
      return failure(
        code,
        'Combined item content exceeds the 256 KiB UTF-8 limit.',
      )
    case 'VAULT_HYDRATING':
    case 'CLOUD_FILE_NOT_DOWNLOADED':
      return failure(
        code,
        'Content is not locally available yet. Retry after download completes.',
        true,
      )
    case 'NAME_CONFLICT':
      return failure(code, 'An item with this name already exists.')
    case 'INVALID_NAME':
    case 'RESERVED_NAME':
      return failure(code, 'The item name is invalid.')
    case 'HTTP_REQUEST_NOT_FOUND':
    case 'NOTE_NOT_FOUND':
    case 'SNIPPET_NOT_FOUND':
    case 'FOLDER_NOT_FOUND':
      return failure('NOT_FOUND', 'Item not found.')
    default:
      return failure('STORAGE_ERROR', 'The storage operation failed.')
  }
}

export async function safely(
  operation: () => unknown | Promise<unknown>,
  oversizedMessage?: string,
): Promise<CallToolResult> {
  try {
    return result(await operation(), oversizedMessage)
  }
  catch (error) {
    return storageFailure(error)
  }
}

export function notifyStorageSynced(): void {
  // A closed window must not turn a completed write into a retryable failure.
  try {
    for (const window of BrowserWindow.getAllWindows()) {
      try {
        window.webContents.send('system:storage-synced')
      }
      catch {}
    }
  }
  catch {}
}
