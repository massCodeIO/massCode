import type { FolderRecord } from '../../../contracts'
import type {
  MarkdownBodyFragment,
  MarkdownFolderMetadataFile,
  MarkdownFrontmatterContent,
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
import { readYamlObjectFile, writeYamlObjectFile } from './shared/yaml'

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
  hasFrontmatter: boolean
} {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)

  if (!match) {
    return { body: source, frontmatter: {}, hasFrontmatter: false }
  }

  const parsed = yaml.load(match[1])

  return {
    body: match[2] || '',
    frontmatter:
      parsed && typeof parsed === 'object'
        ? (parsed as MarkdownSnippetFrontmatter)
        : {},
    hasFrontmatter: true,
  }
}

interface BodyFragmentParseResult {
  fragments: MarkdownBodyFragment[]
  legacyRecovery: 'ambiguous' | 'none' | 'recovered'
}

interface StrictBodyFragmentParseResult {
  fragments: MarkdownBodyFragment[]
  lastCursor: number
}

function getFenceLength(line: string): number {
  let fenceLength = 0

  while (fenceLength < line.length && line.charCodeAt(fenceLength) === 96) {
    fenceLength += 1
  }

  return fenceLength
}

function parseFragmentHeader(line: string): string | null {
  if (!line.startsWith('## Fragment:')) {
    return null
  }

  return line.slice('## Fragment:'.length).trim() || 'Fragment'
}

function hasNonEmptyTail(lines: string[], cursor: number): boolean {
  for (let index = cursor; index < lines.length; index += 1) {
    if (lines[index].trim()) {
      return true
    }
  }

  return false
}

function parseBodyFragmentsStrict(body: string): StrictBodyFragmentParseResult {
  const fragments: MarkdownBodyFragment[] = []
  const lines = body.split(NEW_LINE_SPLIT_RE)
  let lastCursor = 0

  let lineIndex = 0
  while (lineIndex < lines.length) {
    const line = lines[lineIndex]
    const label = parseFragmentHeader(line)

    if (!label) {
      lineIndex += 1
      continue
    }

    lineIndex += 1

    if (lineIndex >= lines.length) {
      continue
    }

    const fenceLine = lines[lineIndex]
    const fenceLength = getFenceLength(fenceLine)

    if (fenceLength < 3) {
      continue
    }

    const fence = '`'.repeat(fenceLength)
    const language = fenceLine.slice(fenceLength).trim() || 'plain_text'
    lineIndex += 1

    const valueLines: string[] = []
    while (lineIndex < lines.length && lines[lineIndex].trim() !== fence) {
      valueLines.push(lines[lineIndex])
      lineIndex += 1
    }

    if (lineIndex < lines.length && lines[lineIndex].trim() === fence) {
      lineIndex += 1
    }

    lastCursor = lineIndex
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

  return { fragments, lastCursor }
}

function findLegacyFragmentOpenings(
  lines: string[],
  metadata: MarkdownFrontmatterContent[],
): number[][] {
  return metadata.map((meta) => {
    const openings: number[] = []

    for (let index = 0; index < lines.length - 1; index += 1) {
      const label = parseFragmentHeader(lines[index])
      if (!label) {
        continue
      }

      const fenceLine = lines[index + 1]
      const fenceLength = getFenceLength(fenceLine)
      if (fenceLength !== 3) {
        continue
      }

      const language = fenceLine.slice(fenceLength).trim() || 'plain_text'
      if (meta.label && label !== meta.label) {
        continue
      }

      if (meta.language && language !== meta.language) {
        continue
      }

      openings.push(index)
    }

    return openings
  })
}

function buildLegacyOpeningSequences(
  openingsByFragment: number[][],
): number[][] {
  const sequences: number[][] = []

  function visit(
    fragmentIndex: number,
    previousOpening: number,
    sequence: number[],
  ): void {
    if (fragmentIndex >= openingsByFragment.length) {
      sequences.push([...sequence])
      return
    }

    for (const openingIndex of openingsByFragment[fragmentIndex]) {
      if (openingIndex <= previousOpening) {
        continue
      }

      sequence.push(openingIndex)
      visit(fragmentIndex + 1, openingIndex, sequence)
      sequence.pop()
    }
  }

  visit(0, -1, [])
  return sequences
}

function parseLegacyTripleFenceFragments(
  body: string,
  metadata: MarkdownFrontmatterContent[],
): BodyFragmentParseResult {
  if (metadata.length === 0) {
    return { fragments: [], legacyRecovery: 'none' }
  }

  const lines = body.split(NEW_LINE_SPLIT_RE)
  const openingsByFragment = findLegacyFragmentOpenings(lines, metadata)
  if (openingsByFragment.some(openings => openings.length === 0)) {
    return { fragments: [], legacyRecovery: 'none' }
  }

  const firstOpening = Math.min(...openingsByFragment[0])
  const sequences = buildLegacyOpeningSequences(openingsByFragment).filter(
    sequence => sequence[0] === firstOpening,
  )

  const recoveredFragmentsBySignature = new Map<
    string,
    MarkdownBodyFragment[]
  >()

  for (const sequence of sequences) {
    const fragments: MarkdownBodyFragment[] = []
    let isValidSequence = true

    for (let index = 0; index < sequence.length; index += 1) {
      const openingIndex = sequence[index]
      const nextOpeningIndex = sequence[index + 1] ?? lines.length
      const closingCandidates: number[] = []

      for (
        let lineIndex = openingIndex + 2;
        lineIndex < nextOpeningIndex;
        lineIndex += 1
      ) {
        if (lines[lineIndex].trim() === '```') {
          closingCandidates.push(lineIndex)
        }
      }

      const closingIndex = closingCandidates.at(-1)
      if (closingIndex === undefined) {
        isValidSequence = false
        break
      }

      const label = parseFragmentHeader(lines[openingIndex]) || 'Fragment'
      const fenceLine = lines[openingIndex + 1]
      const language = fenceLine.slice(3).trim() || 'plain_text'

      fragments.push({
        label,
        language,
        value: lines.slice(openingIndex + 2, closingIndex).join('\n'),
      })
    }

    if (!isValidSequence) {
      continue
    }

    recoveredFragmentsBySignature.set(JSON.stringify(fragments), fragments)
  }

  if (recoveredFragmentsBySignature.size === 1) {
    return {
      fragments: [...recoveredFragmentsBySignature.values()][0],
      legacyRecovery: 'recovered',
    }
  }

  if (recoveredFragmentsBySignature.size > 1) {
    return { fragments: [], legacyRecovery: 'ambiguous' }
  }

  return { fragments: [], legacyRecovery: 'none' }
}

export function parseBodyFragmentsWithMetadata(
  body: string,
  metadata: MarkdownFrontmatterContent[],
): BodyFragmentParseResult {
  const strictResult = parseBodyFragmentsStrict(body)
  const declaredFragmentCount = metadata.length

  if (declaredFragmentCount === 0) {
    return { fragments: strictResult.fragments, legacyRecovery: 'none' }
  }

  const legacyResult = parseLegacyTripleFenceFragments(body, metadata)
  const hasSuspiciousTail
    = strictResult.fragments.length >= declaredFragmentCount
      && hasNonEmptyTail(body.split(NEW_LINE_SPLIT_RE), strictResult.lastCursor)
  const hasLegacyMismatch
    = legacyResult.legacyRecovery === 'recovered'
      && JSON.stringify(legacyResult.fragments)
      !== JSON.stringify(strictResult.fragments)

  if (
    strictResult.fragments.length === declaredFragmentCount
    && !hasSuspiciousTail
    && !hasLegacyMismatch
  ) {
    return { fragments: strictResult.fragments, legacyRecovery: 'none' }
  }

  if (legacyResult.legacyRecovery === 'recovered') {
    return legacyResult
  }

  return {
    fragments: strictResult.fragments,
    legacyRecovery: legacyResult.legacyRecovery,
  }
}

export function parseBodyFragments(body: string): MarkdownBodyFragment[] {
  const { fragments } = parseBodyFragmentsStrict(body)
  return fragments
}

function getSnippetFence(value: string): string {
  const matches = value.match(/`+/g) || []
  let maxLength = 0

  for (const match of matches) {
    if (match.length > maxLength) {
      maxLength = match.length
    }
  }

  const fenceLength = Math.max(3, maxLength + 1)
  return '`'.repeat(fenceLength)
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
      const fence = getSnippetFence(value)

      return `## Fragment: ${label}\n${fence}${language}\n${value}\n${fence}`
    })
    .join('\n\n')

  if (!body) {
    return `---\n${frontmatterText}\n---\n`
  }

  return `---\n${frontmatterText}\n---\n\n${body}\n`
}
