import type {
  ImportApplySummary,
  ImportFile,
  ImportPreview,
  ImportSource,
  SnippetImportParseResult,
} from '../common/types'
import { applySnippetImportResult } from './persist'
import { parseRaycastSnippetFiles } from './raycast'
import { getSnippetImportSourceName } from './source'
import { parseVSCodeSnippetFiles } from './vscode'

function parseSnippetImportFiles(
  source: ImportSource,
  files: ImportFile[] = [],
): SnippetImportParseResult {
  if (source === 'vscode-snippets') {
    return parseVSCodeSnippetFiles(files)
  }

  if (source === 'raycast-snippets') {
    return parseRaycastSnippetFiles(files)
  }

  return {
    snippets: [],
    warnings: [
      {
        message: 'Unsupported import source',
        source,
      },
    ],
  }
}

export function previewSnippetImport(
  source: ImportSource,
  files: ImportFile[] = [],
): ImportPreview {
  const result = parseSnippetImportFiles(source, files)
  const folders = new Map<string, number>()
  const tags = new Map<string, string>()

  result.snippets.forEach((snippet) => {
    const folderPath = snippet.folderPath?.filter(Boolean).join('/')
    if (folderPath) {
      folders.set(folderPath, (folders.get(folderPath) || 0) + 1)
    }

    snippet.tags?.forEach((tag) => {
      tags.set(tag.toLowerCase(), tag)
    })
  })

  return {
    folders: [...folders.entries()].map(([path, snippets]) => ({
      path,
      snippets,
    })),
    groups: [
      {
        name: getSnippetImportSourceName(source),
        snippets: result.snippets.length,
      },
    ],
    snippets: result.snippets.length,
    source,
    tags: [...tags.values()].sort((a, b) => a.localeCompare(b)),
    warnings: result.warnings,
  }
}

export function applySnippetImport(
  source: ImportSource,
  files: ImportFile[] = [],
): ImportApplySummary {
  return applySnippetImportResult(
    source,
    parseSnippetImportFiles(source, files),
  )
}

export type {
  ImportApplySummary,
  ImportFile,
  ImportPreview,
  ImportSource,
} from '../common/types'
