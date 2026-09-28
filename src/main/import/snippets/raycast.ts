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

type RaycastRecord = Record<string, unknown>

function parseJsonFile(file: ImportFile): unknown | null {
  try {
    return JSON.parse(file.content)
  }
  catch {
    return null
  }
}

function getSnippetRecords(parsed: unknown): RaycastRecord[] | null {
  if (Array.isArray(parsed)) {
    return parsed.filter(
      (item): item is RaycastRecord =>
        !!item && typeof item === 'object' && !Array.isArray(item),
    )
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null
  }

  const object = parsed as RaycastRecord
  const snippets = object.snippets || object.items
  if (!Array.isArray(snippets)) {
    return null
  }

  return snippets.filter(
    (item): item is RaycastRecord =>
      !!item && typeof item === 'object' && !Array.isArray(item),
  )
}

function readString(record: RaycastRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) {
      return value
    }
  }

  return null
}

function getFolderPath(record: RaycastRecord): string[] {
  const folder = readString(record, ['folder', 'group', 'collection'])
  if (!folder) {
    return []
  }

  return folder
    .split('/')
    .map(part => normalizeImportEntryName(part, 'Imported'))
    .filter(Boolean)
}

function getTags(record: RaycastRecord): string[] {
  const tags: string[] = []
  const rawTags = record.tags
  if (Array.isArray(rawTags)) {
    tags.push(
      ...rawTags.map(normalizeImportTag).filter((tag): tag is string => !!tag),
    )
  }

  return uniqueStrings(tags)
}

export function parseRaycastSnippetFiles(
  files: ImportFile[],
): SnippetImportParseResult {
  const snippets: SnippetImportCandidate[] = []
  const warnings: SnippetImportParseResult['warnings'] = []

  for (const file of files) {
    const parsed = parseJsonFile(file)
    const records = getSnippetRecords(parsed)

    if (!records) {
      warnings.push({
        code: 'raycast.invalidExport',
        source: file.name,
      })
      continue
    }

    records.forEach((record, index) => {
      const content = readString(record, ['text', 'content', 'snippet'])
      if (!content) {
        warnings.push({
          code: 'raycast.emptyText',
          source: `${file.name}/${index + 1}`,
        })
        return
      }

      snippets.push({
        contents: [
          {
            label: 'Fragment 1',
            language: 'plain_text',
            value: content,
          },
        ],
        description: readString(record, ['description']) ?? null,
        folderPath: getFolderPath(record),
        name: normalizeImportEntryName(
          readString(record, ['name', 'title']),
          `Raycast snippet ${index + 1}`,
        ),
        sourceId: readString(record, ['id']) ?? `${file.name}:${index + 1}`,
        tags: getTags(record),
      })
    })
  }

  return { snippets, warnings }
}
