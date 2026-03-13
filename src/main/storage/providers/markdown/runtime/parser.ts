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
import {
  LEGACY_FOLDER_META_FILE_NAME,
  META_FILE_NAME,
  NEW_LINE_SPLIT_RE,
} from './constants'

export function readYamlObjectFile<T>(filePath: string): T | null {
  if (!fs.pathExistsSync(filePath)) {
    return null
  }

  try {
    const source = fs.readFileSync(filePath, 'utf8')
    const parsed = yaml.load(source)

    if (!parsed || typeof parsed !== 'object') {
      return null
    }

    return parsed as T
  }
  catch {
    return null
  }
}

export function writeYamlObjectFile(
  filePath: string,
  data: Record<string, unknown>,
): void {
  const body = yaml
    .dump(data, {
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
    })
    .trim()

  fs.ensureDirSync(path.dirname(filePath))
  fs.writeFileSync(filePath, `${body}\n`, 'utf8')
}

export function readFolderMetadata(
  paths: Paths,
  folderRelativePath: string,
): MarkdownFolderMetadataFile {
  const folderAbsPath = path.join(paths.vaultPath, folderRelativePath)
  const metaPath = path.join(folderAbsPath, META_FILE_NAME)
  const legacyPath = path.join(folderAbsPath, LEGACY_FOLDER_META_FILE_NAME)

  // Step 1: Try .meta.yaml
  const metaData = readYamlObjectFile<MarkdownFolderMetadataFile>(metaPath)
  if (metaData) {
    return metaData
  }

  // Step 2: Try legacy .masscode-folder.yml
  const legacyData = readYamlObjectFile<MarkdownFolderMetadataFile>(legacyPath)
  if (!legacyData) {
    return {}
  }

  // Step 3: Migrate legacy → .meta.yaml
  const migrated: MarkdownFolderMetadataFile = { ...legacyData }
  if (migrated.masscode_id !== undefined && migrated.masscode_id !== null) {
    migrated.id = migrated.masscode_id
    delete migrated.masscode_id
  }

  try {
    writeYamlObjectFile(metaPath, migrated as Record<string, unknown>)
    fs.removeSync(legacyPath)
  }
  catch {
    // Migration failed — non-critical, we still have the data
  }

  return migrated
}

export function serializeFolderMetadata(
  folder: FolderRecord,
): Record<string, unknown> {
  return {
    id: folder.id,
    createdAt: folder.createdAt,
    defaultLanguage: folder.defaultLanguage,
    icon: folder.icon,
    name: folder.name,
    orderIndex: folder.orderIndex,
    updatedAt: folder.updatedAt,
  }
}

export function writeFolderMetadataFile(
  paths: Paths,
  folderRelativePath: string,
  folder: FolderRecord,
): void {
  const folderAbsPath = path.join(paths.vaultPath, folderRelativePath)
  const metaPath = path.join(folderAbsPath, META_FILE_NAME)
  const payload = serializeFolderMetadata(folder)

  const body = yaml
    .dump(payload, {
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
    })
    .trim()

  const nextContent = `${body}\n`

  if (fs.pathExistsSync(metaPath)) {
    const currentContent = fs.readFileSync(metaPath, 'utf8')
    if (currentContent === nextContent) {
      return
    }
  }

  fs.ensureDirSync(folderAbsPath)
  fs.writeFileSync(metaPath, nextContent, 'utf8')

  // Clean up legacy file if it exists
  const legacyPath = path.join(folderAbsPath, LEGACY_FOLDER_META_FILE_NAME)
  if (fs.pathExistsSync(legacyPath)) {
    try {
      fs.removeSync(legacyPath)
    }
    catch {
      // Non-critical
    }
  }
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
