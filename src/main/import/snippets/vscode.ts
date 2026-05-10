import type {
  ImportFile,
  SnippetImportCandidate,
  SnippetImportParseResult,
} from '../common/types'
import path from 'node:path'
import {
  normalizeImportEntryName,
  normalizeImportTag,
  uniqueStrings,
} from './normalizers'

interface VSCodeSnippetValue {
  body?: unknown
  description?: unknown
  prefix?: unknown
  scope?: unknown
}

const LANGUAGE_FILE_NAMES = new Set([
  'bash',
  'c',
  'cpp',
  'csharp',
  'css',
  'dart',
  'dockerfile',
  'go',
  'html',
  'java',
  'javascript',
  'json',
  'kotlin',
  'less',
  'markdown',
  'php',
  'python',
  'ruby',
  'rust',
  'scss',
  'sh',
  'shellscript',
  'sql',
  'swift',
  'typescript',
  'vue',
  'xml',
  'yaml',
])

function parseJsonFile(file: ImportFile): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(file.content)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  }
  catch {
    return null
  }
}

function getSnippetBody(value: unknown): string | null {
  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
    return value.join('\n')
  }

  return null
}

function inferLanguage(fileName: string, snippet: VSCodeSnippetValue): string {
  if (typeof snippet.scope === 'string' && snippet.scope.trim()) {
    return snippet.scope.split(',')[0].trim()
  }

  const baseName = path.basename(fileName)
  if (baseName.endsWith('.code-snippets')) {
    return 'plain_text'
  }

  if (baseName.endsWith('.json')) {
    const language = path.basename(baseName, '.json')
    return LANGUAGE_FILE_NAMES.has(language) ? language : 'plain_text'
  }

  return 'plain_text'
}

function getPrefixTags(prefix: unknown): string[] {
  if (typeof prefix === 'string') {
    const tag = normalizeImportTag(prefix)
    return tag ? [tag] : []
  }

  if (Array.isArray(prefix)) {
    return uniqueStrings(
      prefix.map(normalizeImportTag).filter((tag): tag is string => !!tag),
    )
  }

  return []
}

export function parseVSCodeSnippetFiles(
  files: ImportFile[],
): SnippetImportParseResult {
  const snippets: SnippetImportCandidate[] = []
  const warnings: SnippetImportParseResult['warnings'] = []

  for (const file of files) {
    const parsed = parseJsonFile(file)
    if (!parsed) {
      warnings.push({
        code: 'vscode.invalidJson',
        source: file.name,
      })
      continue
    }

    Object.entries(parsed).forEach(([key, value]) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        warnings.push({
          code: 'vscode.entryNotObject',
          source: `${file.name}/${key}`,
        })
        return
      }

      const snippet = value as VSCodeSnippetValue
      const body = getSnippetBody(snippet.body)
      if (body === null) {
        warnings.push({
          code: 'vscode.invalidBody',
          source: `${file.name}/${key}`,
        })
        return
      }

      snippets.push({
        contents: [
          {
            label: 'Fragment 1',
            language: inferLanguage(file.name, snippet),
            value: body,
          },
        ],
        description:
          typeof snippet.description === 'string' ? snippet.description : null,
        name: normalizeImportEntryName(key, 'Untitled snippet'),
        sourceId: `${file.name}:${key}`,
        tags: getPrefixTags(snippet.prefix),
      })
    })
  }

  return { snippets, warnings }
}
