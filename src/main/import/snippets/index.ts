import type {
  ImportApplySummary,
  ImportPayload,
  ImportPreview,
  ImportSource,
  SnippetImportParseResult,
} from '../common/types'
import { fetchGitHubGistImport } from './githubGists'
import { applySnippetImportResult } from './persist'
import { parseRaycastSnippetFiles } from './raycast'
import { parseSnippetsLabFiles } from './snippetsLab'
import { getSnippetImportSourceName } from './source'
import { parseVSCodeSnippetFiles } from './vscode'

async function parseSnippetImportPayload(
  source: ImportSource,
  payload: ImportPayload = {},
): Promise<SnippetImportParseResult> {
  if (source === 'github-gists') {
    return fetchGitHubGistImport(payload.url)
  }

  const files = payload.files || []

  if (source === 'vscode-snippets') {
    return parseVSCodeSnippetFiles(files)
  }

  if (source === 'raycast-snippets') {
    return parseRaycastSnippetFiles(files)
  }

  if (source === 'snippetslab') {
    return parseSnippetsLabFiles(files)
  }

  return {
    snippets: [],
    warnings: [
      {
        code: 'source.unsupported',
        source,
      },
    ],
  }
}

export async function previewSnippetImport(
  source: ImportSource,
  payload: ImportPayload = {},
): Promise<ImportPreview> {
  const result = await parseSnippetImportPayload(source, payload)
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
    notes: 0,
    snippets: result.snippets.length,
    source,
    tags: [...tags.values()].sort((a, b) => a.localeCompare(b)),
    warnings: result.warnings,
  }
}

export function applySnippetImport(
  source: ImportSource,
  payload: ImportPayload = {},
): Promise<ImportApplySummary> {
  return parseSnippetImportPayload(source, payload).then(result =>
    applySnippetImportResult(source, result),
  )
}

export type {
  ImportApplySummary,
  ImportFile,
  ImportPayload,
  ImportPreview,
  ImportSource,
} from '../common/types'
