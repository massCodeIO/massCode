import type {
  ImportFile,
  NoteImportCandidate,
  NoteImportParseResult,
} from '../common/types'
import path from 'node:path'
import yaml from 'js-yaml'
import {
  normalizeImportEntryName,
  normalizeImportTag,
} from '../snippets/normalizers'

function getImportPath(file: ImportFile): string {
  return (file.relativePath || file.name).replace(/\\/g, '/')
}

function getFolderPath(filePath: string): string[] {
  const directory = path.posix.dirname(filePath)

  if (!directory || directory === '.') {
    return []
  }

  return directory
    .split('/')
    .map(part => normalizeImportEntryName(part, 'Imported'))
    .filter(Boolean)
}

function getNoteName(filePath: string): string {
  const basename = path.posix.basename(filePath)
  return normalizeImportEntryName(
    basename.toLowerCase().endsWith('.md') ? basename.slice(0, -3) : basename,
    'Untitled note',
  )
}

function parseFrontmatterTags(content: string): string[] {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!match) {
    return []
  }

  const parsed = yaml.load(match[1])
  if (!parsed || typeof parsed !== 'object') {
    return []
  }

  const tags = (parsed as { tags?: unknown }).tags
  if (typeof tags === 'string') {
    return tags
      .split(/[,\s]+/)
      .map(normalizeImportTag)
      .filter((tag): tag is string => !!tag)
  }

  if (Array.isArray(tags)) {
    return tags.map(normalizeImportTag).filter((tag): tag is string => !!tag)
  }

  return []
}

function parseInlineTags(content: string): string[] {
  const tags: string[] = []
  const tagPattern = /(?:^|\s)#([\w/-]+)/g

  while (true) {
    const match = tagPattern.exec(content)
    if (!match) {
      break
    }

    const tag = normalizeImportTag(match[1])
    if (tag) {
      tags.push(tag)
    }
  }

  return tags
}

function uniqueTags(tags: string[]): string[] {
  const result: string[] = []
  const seen = new Set<string>()

  tags.forEach((tag) => {
    const key = tag.toLowerCase()
    if (seen.has(key)) {
      return
    }

    seen.add(key)
    result.push(tag)
  })

  return result
}

export function parseObsidianMarkdownFiles(
  files: ImportFile[],
): NoteImportParseResult {
  const notes: NoteImportCandidate[] = []
  const warnings: NoteImportParseResult['warnings'] = []

  files.forEach((file) => {
    const filePath = getImportPath(file)
    if (!filePath.toLowerCase().endsWith('.md')) {
      return
    }

    if (!file.content.trim()) {
      warnings.push({
        message: 'Markdown file is empty',
        source: filePath,
      })
      return
    }

    notes.push({
      content: file.content,
      folderPath: getFolderPath(filePath),
      name: getNoteName(filePath),
      sourceId: filePath,
      tags: uniqueTags([
        ...parseFrontmatterTags(file.content),
        ...parseInlineTags(file.content),
      ]),
    })
  })

  if (!notes.length && !warnings.length) {
    warnings.push({
      message: 'No markdown files found in Obsidian import',
      source: 'obsidian',
    })
  }

  return { notes, warnings }
}
