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

function isSupportedMarkdownFile(filePath: string): boolean {
  return (
    filePath.toLowerCase().endsWith('.md')
    && !filePath.toLowerCase().endsWith('.excalidraw.md')
  )
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

function parseFrontmatter(content: string): {
  content: string
  ignoredKeys: string[]
  tags: string[]
} {
  const match = content.match(
    /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/,
  )
  if (!match) {
    return { content, ignoredKeys: [], tags: [] }
  }

  const parsed = yaml.load(match[1])
  if (!parsed || typeof parsed !== 'object') {
    return { content: match[2] ?? '', ignoredKeys: [], tags: [] }
  }

  const frontmatter = parsed as Record<string, unknown>
  const ignoredKeys = Object.keys(frontmatter).filter(key => key !== 'tags')
  const tags = frontmatter.tags
  if (typeof tags === 'string') {
    return {
      content: match[2] ?? '',
      ignoredKeys,
      tags: tags
        .split(/[,\s]+/)
        .map(normalizeImportTag)
        .filter((tag): tag is string => !!tag),
    }
  }

  if (Array.isArray(tags)) {
    return {
      content: match[2] ?? '',
      ignoredKeys,
      tags: tags.map(normalizeImportTag).filter((tag): tag is string => !!tag),
    }
  }

  return { content: match[2] ?? '', ignoredKeys, tags: [] }
}

function isImportableTag(tag: string): boolean {
  return /[\p{L}_]/u.test(tag) && !/^\d+$/u.test(tag)
}

function uniqueTags(tags: string[]): string[] {
  const result: string[] = []
  const seen = new Set<string>()

  tags.forEach((tag) => {
    if (!isImportableTag(tag)) {
      return
    }

    const key = tag.toLowerCase()
    if (seen.has(key)) {
      return
    }

    seen.add(key)
    result.push(tag)
  })

  return result
}

function hasWikiLinks(content: string): boolean {
  return /(?:^|[^!])\[\[[^\]]+\]\]/.test(content)
}

function hasAttachmentReferences(content: string): boolean {
  return (
    /!\[\[[^\]]+\]\]/.test(content)
    || /!\[[^\]]*\]\((?!https?:\/\/|data:|#)[^)]+\)/i.test(content)
  )
}

export function parseObsidianMarkdownFiles(
  files: ImportFile[],
): NoteImportParseResult {
  const notes: NoteImportCandidate[] = []
  const warnings: NoteImportParseResult['warnings'] = []

  files.forEach((file) => {
    const filePath = getImportPath(file)
    if (!isSupportedMarkdownFile(filePath)) {
      if (filePath.toLowerCase().endsWith('.excalidraw.md')) {
        warnings.push({
          message: 'Excalidraw markdown file was skipped',
          source: filePath,
        })
      }
      return
    }

    const parsed = parseFrontmatter(file.content)

    if (!parsed.content.trim()) {
      warnings.push({
        message: 'Markdown file is empty',
        source: filePath,
      })
      return
    }

    if (parsed.ignoredKeys.length) {
      warnings.push({
        message: `Frontmatter fields ignored: ${parsed.ignoredKeys.join(', ')}`,
        source: filePath,
      })
    }

    if (hasAttachmentReferences(parsed.content)) {
      warnings.push({
        message:
          'Attachment references are kept as text; attachment files are not imported',
        source: filePath,
      })
    }

    if (hasWikiLinks(parsed.content)) {
      warnings.push({
        message:
          'Obsidian wiki links are imported as text and are not rewritten',
        source: filePath,
      })
    }

    notes.push({
      content: parsed.content,
      folderPath: getFolderPath(filePath),
      name: getNoteName(filePath),
      sourceId: filePath,
      tags: uniqueTags(parsed.tags),
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
