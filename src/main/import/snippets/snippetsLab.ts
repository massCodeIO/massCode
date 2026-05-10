import type {
  ImportFile,
  SnippetImportCandidate,
  SnippetImportParseResult,
} from '../common/types'
import {
  normalizeImportEntryName,
  normalizeImportTag,
  uniqueStrings,
} from './normalizers'

type SnippetsLabRecord = Record<string, unknown>

const LANGUAGE_BY_LEXER: Record<string, string> = {
  ApacheConfLexer: 'apache_conf',
  BashLexer: 'sh',
  CssLexer: 'css',
  HtmlLexer: 'html',
  JavascriptLexer: 'javascript',
  JsonLexer: 'json',
  MarkdownLexer: 'markdown',
  NginxConfLexer: 'nginx',
  PhpLexer: 'php',
  RubyLexer: 'ruby',
  ScssLexer: 'scss',
  SwiftLexer: 'swift',
  TextLexer: 'plain_text',
  TypeScriptLexer: 'typescript',
}

function isRecord(value: unknown): value is SnippetsLabRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function parseJsonFile(file: ImportFile): unknown | null {
  try {
    return JSON.parse(file.content)
  }
  catch {
    return null
  }
}

function readString(record: SnippetsLabRecord, key: string): string | null {
  const value = record[key]
  return typeof value === 'string' && value.trim() ? value : null
}

function getRecordArray(record: SnippetsLabRecord, key: string) {
  const value = record[key]
  return Array.isArray(value) ? value.filter(isRecord) : []
}

function getContents(parsed: unknown): SnippetsLabRecord | null {
  if (!isRecord(parsed) || !isRecord(parsed.contents)) {
    return null
  }

  const snippets = getRecordArray(parsed.contents, 'snippets')
  const schema = readString(parsed, 'schema')
  const app = readString(parsed, 'app')

  if (!snippets.length || (!schema && !app)) {
    return null
  }

  return parsed.contents
}

function buildFolderPathMap(
  folders: SnippetsLabRecord[],
): Map<string, string[]> {
  const map = new Map<string, string[]>()

  function visit(folder: SnippetsLabRecord, parentPath: string[]) {
    const uuid = readString(folder, 'uuid')
    const title = normalizeImportEntryName(
      readString(folder, 'title'),
      'Imported',
    )
    const folderPath = [...parentPath, title]

    if (uuid) {
      map.set(uuid, folderPath)
    }

    getRecordArray(folder, 'children').forEach(child =>
      visit(child, folderPath),
    )
  }

  folders.forEach(folder => visit(folder, []))

  return map
}

function buildTagMap(tags: SnippetsLabRecord[]): Map<string, string> {
  const map = new Map<string, string>()

  tags.forEach((tag) => {
    const uuid = readString(tag, 'uuid')
    const title = normalizeImportTag(readString(tag, 'title'))

    if (uuid && title) {
      map.set(uuid, title)
    }
  })

  return map
}

function getTags(record: SnippetsLabRecord, tagMap: Map<string, string>) {
  const rawTags = record.tags
  if (!Array.isArray(rawTags)) {
    return []
  }

  return uniqueStrings(
    rawTags
      .map(tag =>
        typeof tag === 'string'
          ? tagMap.get(tag) || normalizeImportTag(tag)
          : null,
      )
      .filter((tag): tag is string => !!tag),
  )
}

function normalizeLexer(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    return 'plain_text'
  }

  return LANGUAGE_BY_LEXER[value] || 'plain_text'
}

function getDescription(record: SnippetsLabRecord): string | null {
  const descriptionParts: string[] = []
  const sourceUrl = readString(record, 'githubHTMLURL')
  if (sourceUrl) {
    descriptionParts.push(sourceUrl)
  }

  const notes = getRecordArray(record, 'fragments')
    .map((fragment) => {
      const note = readString(fragment, 'note')
      if (!note) {
        return null
      }

      const title = readString(fragment, 'title')
      return title && title !== 'Fragment' ? `${title}:\n${note}` : note
    })
    .filter((note): note is string => !!note)

  descriptionParts.push(...uniqueStrings(notes))

  return descriptionParts.length ? descriptionParts.join('\n\n') : null
}

export function parseSnippetsLabFiles(
  files: ImportFile[],
): SnippetImportParseResult {
  const snippets: SnippetImportCandidate[] = []
  const warnings: SnippetImportParseResult['warnings'] = []

  for (const file of files) {
    const parsed = parseJsonFile(file)
    const contents = getContents(parsed)

    if (!contents) {
      warnings.push({
        message: 'File is not a valid SnippetsLab export',
        source: file.name,
      })
      continue
    }

    const folderPathMap = buildFolderPathMap(
      getRecordArray(contents, 'folders'),
    )
    const tagMap = buildTagMap(getRecordArray(contents, 'tags'))
    const smartGroups = getRecordArray(contents, 'smartGroups')

    if (smartGroups.length) {
      warnings.push({
        message: 'SnippetsLab smart groups are not imported',
        source: file.name,
      })
    }

    getRecordArray(contents, 'snippets').forEach((record, index) => {
      const sourceId
        = readString(record, 'uuid') ?? `${file.name}:${index + 1}`
      const fragments = getRecordArray(record, 'fragments')
      const contents = fragments
        .map((fragment, fragmentIndex) => {
          const value = readString(fragment, 'content')
          if (!value) {
            return null
          }

          const attachments = fragment.attachments
          if (Array.isArray(attachments) && attachments.length) {
            warnings.push({
              message: 'SnippetsLab fragment attachments are not imported',
              source: `${file.name}/${sourceId}`,
            })
          }

          return {
            label: normalizeImportEntryName(
              readString(fragment, 'title'),
              `Fragment ${fragmentIndex + 1}`,
            ),
            language: normalizeLexer(fragment.language),
            value,
          }
        })
        .filter(
          (content): content is SnippetImportCandidate['contents'][number] =>
            !!content,
        )

      if (!contents.length) {
        warnings.push({
          message: 'SnippetsLab snippet has no importable fragments',
          source: `${file.name}/${sourceId}`,
        })
        return
      }

      const folderId = readString(record, 'folder')

      snippets.push({
        contents,
        description: getDescription(record),
        folderPath: folderId ? folderPathMap.get(folderId) || [] : [],
        name: normalizeImportEntryName(
          readString(record, 'title'),
          `SnippetsLab snippet ${index + 1}`,
        ),
        sourceId,
        sourceUrl: readString(record, 'githubHTMLURL') ?? undefined,
        tags: getTags(record, tagMap),
      })
    })
  }

  return { snippets, warnings }
}
