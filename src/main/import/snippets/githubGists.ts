import type {
  SnippetImportCandidate,
  SnippetImportParseResult,
} from '../common/types'
import path from 'node:path'
import { normalizeImportEntryName } from './normalizers'

interface GitHubGistFile {
  content?: unknown
  filename?: unknown
  language?: unknown
  raw_url?: unknown
  truncated?: unknown
  type?: unknown
}

interface GitHubGistResponse {
  description?: unknown
  files?: unknown
  html_url?: unknown
  id?: unknown
}

function getGistId(value: string): string | null {
  const trimmed = value.trim()

  if (/^[\da-f]{20,64}$/i.test(trimmed)) {
    return trimmed
  }

  const match = trimmed.match(
    /gist\.github\.com\/(?:[^/]+\/)?([\da-f]{20,64})/i,
  )
  return match?.[1] ?? null
}

function getLanguage(file: GitHubGistFile): string {
  if (typeof file.language === 'string' && file.language.trim()) {
    return file.language.trim().toLowerCase().replace(/\s+/g, '_')
  }

  if (typeof file.filename !== 'string') {
    return 'plain_text'
  }

  const extension = path.extname(file.filename).slice(1)
  return extension || 'plain_text'
}

function getSnippetName(gist: GitHubGistResponse, files: GitHubGistFile[]) {
  if (typeof gist.description === 'string' && gist.description.trim()) {
    return normalizeImportEntryName(gist.description, 'GitHub Gist')
  }

  const firstFile = files.find(file => typeof file.filename === 'string')
  if (typeof firstFile?.filename === 'string') {
    return normalizeImportEntryName(
      path.basename(firstFile.filename, path.extname(firstFile.filename)),
      'GitHub Gist',
    )
  }

  return 'GitHub Gist'
}

function getGistFiles(gist: GitHubGistResponse): GitHubGistFile[] {
  if (
    !gist.files
    || typeof gist.files !== 'object'
    || Array.isArray(gist.files)
  ) {
    return []
  }

  return Object.values(gist.files).filter(
    (file): file is GitHubGistFile =>
      !!file && typeof file === 'object' && !Array.isArray(file),
  )
}

function getGistRequestErrorMessage(status: number): string {
  if (status === 401 || status === 403) {
    return 'GitHub Gist import supports public Gists only; private or rate-limited Gists require authentication'
  }

  if (status === 404) {
    return 'GitHub Gist was not found or is not public'
  }

  return `GitHub Gist request failed with status ${status}`
}

export function parseGitHubGistResponse(
  gist: GitHubGistResponse,
  source: string,
): SnippetImportParseResult {
  const files = getGistFiles(gist)
  const warnings: SnippetImportParseResult['warnings'] = []

  if (!files.length) {
    return {
      snippets: [],
      warnings: [
        {
          message: 'GitHub Gist has no files',
          source,
        },
      ],
    }
  }

  const contents: SnippetImportCandidate['contents'] = []

  files.forEach((file) => {
    const filename
      = typeof file.filename === 'string' && file.filename.trim()
        ? file.filename
        : 'gist-file'

    if (file.truncated) {
      warnings.push({
        message: 'Truncated Gist files are skipped in this import version',
        source: `${source}/${filename}`,
      })
      return
    }

    if (typeof file.content !== 'string') {
      warnings.push({
        message: 'Gist file content is missing',
        source: `${source}/${filename}`,
      })
      return
    }

    contents.push({
      label: normalizeImportEntryName(filename, 'Fragment'),
      language: getLanguage(file),
      value: file.content,
    })
  })

  if (!contents.length) {
    return {
      snippets: [],
      warnings,
    }
  }

  return {
    snippets: [
      {
        contents,
        description:
          typeof gist.html_url === 'string' && gist.html_url.trim()
            ? gist.html_url
            : null,
        name: getSnippetName(gist, files),
        sourceId: typeof gist.id === 'string' ? gist.id : source,
        sourceUrl:
          typeof gist.html_url === 'string' ? gist.html_url : undefined,
        tags: ['gist'],
      },
    ],
    warnings,
  }
}

export async function fetchGitHubGistImport(
  urlOrId: string | undefined,
): Promise<SnippetImportParseResult> {
  if (!urlOrId?.trim()) {
    throw new Error('GitHub Gist URL is required')
  }

  const gistId = getGistId(urlOrId)
  if (!gistId) {
    throw new Error('Invalid GitHub Gist URL')
  }

  const response = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'massCode',
    },
  })

  if (!response.ok) {
    throw new Error(getGistRequestErrorMessage(response.status))
  }

  return parseGitHubGistResponse(
    (await response.json()) as GitHubGistResponse,
    urlOrId,
  )
}
