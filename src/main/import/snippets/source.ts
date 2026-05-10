import type { ImportSource } from '../common/types'

export function getSnippetImportSourceName(source: ImportSource): string {
  if (source === 'github-gists') {
    return 'GitHub Gists'
  }

  if (source === 'vscode-snippets') {
    return 'VS Code'
  }

  if (source === 'raycast-snippets') {
    return 'Raycast'
  }

  if (source === 'snippetslab') {
    return 'SnippetsLab'
  }

  return 'Imported'
}
