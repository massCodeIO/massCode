import type { ImportPayload, ImportSource } from './common/types'
import { parseRaycastSnippetFiles } from './snippets/raycast'
import { parseVSCodeSnippetFiles } from './snippets/vscode'

function hasMarkdownFiles(payload: ImportPayload): boolean {
  return (payload.files || []).some((file) => {
    const filePath = (file.relativePath || file.name).toLowerCase()
    return filePath.endsWith('.md')
  })
}

function detectSnippetSource(payload: ImportPayload): ImportSource {
  if (payload.url?.trim()) {
    return 'github-gists'
  }

  const raycast = parseRaycastSnippetFiles(payload.files || [])
  const vscode = parseVSCodeSnippetFiles(payload.files || [])

  if (raycast.snippets.length > 0 || vscode.snippets.length > 0) {
    return raycast.snippets.length >= vscode.snippets.length
      ? 'raycast-snippets'
      : 'vscode-snippets'
  }

  throw new Error('Import format could not be detected')
}

export function detectImportSource(
  source: ImportSource | undefined,
  payload: ImportPayload,
): ImportSource {
  if (source) {
    return source
  }

  if (payload.space === 'notes') {
    return 'obsidian'
  }

  if (payload.space === 'code') {
    return detectSnippetSource(payload)
  }

  if (hasMarkdownFiles(payload)) {
    return 'obsidian'
  }

  return detectSnippetSource(payload)
}
