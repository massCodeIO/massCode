import type { FolderRecord } from '../../../contracts'
import type {
  MarkdownBodyFragment,
  MarkdownFolderMetadataFile,
  MarkdownSnippet,
  MarkdownSnippetFrontmatter,
  Paths,
} from './types'
import path from 'node:path'
import fs from 'fs-extra'
import yaml from 'js-yaml'
import { FOLDER_META_FILE_NAME, NEW_LINE_SPLIT_RE } from './constants'

export function getFolderMetaFilePath(
  paths: Paths,
  folderRelativePath: string,
): string {
  return path.join(paths.vaultPath, folderRelativePath, FOLDER_META_FILE_NAME)
}

export function readFolderMetadata(
  paths: Paths,
  folderRelativePath: string,
): MarkdownFolderMetadataFile {
  const metadataPath = getFolderMetaFilePath(paths, folderRelativePath)

  if (!fs.pathExistsSync(metadataPath)) {
    return {}
  }

  try {
    const source = fs.readFileSync(metadataPath, 'utf8')
    const parsed = yaml.load(source)

    if (!parsed || typeof parsed !== 'object') {
      return {}
    }

    return parsed as MarkdownFolderMetadataFile
  }
  catch {
    return {}
  }
}

export function serializeFolderMetadata(folder: FolderRecord): string {
  const payload: MarkdownFolderMetadataFile = {
    createdAt: folder.createdAt,
    defaultLanguage: folder.defaultLanguage,
    icon: folder.icon,
    masscode_id: folder.id,
    name: folder.name,
    orderIndex: folder.orderIndex,
    updatedAt: folder.updatedAt,
  }

  const body = yaml
    .dump(payload, {
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
    })
    .trim()

  return `${body}\n`
}

export function writeFolderMetadataFile(
  paths: Paths,
  folderRelativePath: string,
  folder: FolderRecord,
): void {
  const metadataPath = getFolderMetaFilePath(paths, folderRelativePath)
  const nextContent = serializeFolderMetadata(folder)

  if (fs.pathExistsSync(metadataPath)) {
    const currentContent = fs.readFileSync(metadataPath, 'utf8')
    if (currentContent === nextContent) {
      return
    }
  }

  fs.writeFileSync(metadataPath, nextContent, 'utf8')
}

export function splitFrontmatter(source: string): {
  body: string
  frontmatter: MarkdownSnippetFrontmatter
} {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)

  if (!match) {
    return { body: source, frontmatter: {} }
  }

  const parsed = yaml.load(match[1])

  return {
    body: match[2] || '',
    frontmatter:
      parsed && typeof parsed === 'object'
        ? (parsed as MarkdownSnippetFrontmatter)
        : {},
  }
}

export function parseBodyFragments(body: string): MarkdownBodyFragment[] {
  const fragments: MarkdownBodyFragment[] = []
  const lines = body.split(NEW_LINE_SPLIT_RE)

  let lineIndex = 0
  while (lineIndex < lines.length) {
    const line = lines[lineIndex]

    if (!line.startsWith('## Fragment:')) {
      lineIndex += 1
      continue
    }

    const label = line.slice('## Fragment:'.length).trim() || 'Fragment'
    lineIndex += 1

    if (lineIndex >= lines.length || !lines[lineIndex].startsWith('```')) {
      continue
    }

    const language = lines[lineIndex].slice(3).trim() || 'plain_text'
    lineIndex += 1

    const valueLines: string[] = []
    while (lineIndex < lines.length && !lines[lineIndex].startsWith('```')) {
      valueLines.push(lines[lineIndex])
      lineIndex += 1
    }

    if (lineIndex < lines.length && lines[lineIndex].startsWith('```')) {
      lineIndex += 1
    }

    fragments.push({
      label,
      language,
      value: valueLines.join('\n'),
    })
  }

  if (fragments.length === 0 && body.trim()) {
    fragments.push({
      label: 'Fragment 1',
      language: 'plain_text',
      value: body,
    })
  }

  return fragments
}

export function serializeSnippet(snippet: MarkdownSnippet): string {
  const frontmatter: MarkdownSnippetFrontmatter = {
    contents: snippet.contents.map(content => ({
      id: content.id,
      label: content.label,
      language: content.language,
    })),
    createdAt: snippet.createdAt,
    description: snippet.description,
    folderId: snippet.folderId,
    id: snippet.id,
    isDeleted: snippet.isDeleted,
    isFavorites: snippet.isFavorites,
    name: snippet.name,
    tags: snippet.tags,
    updatedAt: snippet.updatedAt,
  }

  const frontmatterText = yaml
    .dump(frontmatter, {
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
    })
    .trim()

  const body = snippet.contents
    .map((content) => {
      const label = content.label.replace(/\r?\n/g, ' ').trim() || 'Fragment'
      const language = content.language.trim() || 'plain_text'
      const value = content.value || ''

      return `## Fragment: ${label}\n\`\`\`${language}\n${value}\n\`\`\``
    })
    .join('\n\n')

  if (!body) {
    return `---\n${frontmatterText}\n---\n`
  }

  return `---\n${frontmatterText}\n---\n\n${body}\n`
}
