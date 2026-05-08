import type { ImportSource } from '../common/types'

export function getSnippetImportSourceName(source: ImportSource): string {
  if (source === 'vscode-snippets') {
    return 'VS Code'
  }

  if (source === 'raycast-snippets') {
    return 'Raycast'
  }

  return 'Imported'
}
