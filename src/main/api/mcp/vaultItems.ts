import type { CallToolResult } from '@modelcontextprotocol/server'
import type { EntryNameValidationIssue } from '../../../shared/entryNameValidation'
import type {
  NoteRecord,
  SnippetRecord,
  TagRecord,
} from '../../storage/contracts'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { formatEntryNameValidationChars } from '../../../shared/entryNameValidation'
import { useNotesStorage, useStorage } from '../../storage'
import { store } from '../../store'
import { CONTENT_LIMIT, failure, storageFailure } from './results'

export type VaultType = 'snippet' | 'note'

export function vaultMetadata(
  type: VaultType,
  item: SnippetRecord | NoteRecord,
) {
  return {
    type,
    id: item.id,
    name: item.name,
    folder: item.folder,
    tags: item.tags,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    languages:
      'contents' in item
        ? [...new Set(item.contents.map(content => content.language))]
        : ['markdown'],
    pendingCloudDownload: item.pendingCloudDownload === true,
  }
}

function revision(value: unknown): string {
  return createHash('sha256')
    .update(
      JSON.stringify(value, (_key, item) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? Object.fromEntries(
              Object.entries(item).sort(([a], [b]) => a.localeCompare(b)),
            )
          : item),
    )
    .digest('hex')
}

// updatedAt, избранное, description и properties не входят в ревизию: MCP их
// не редактирует, и их смена не должна давать ложный CONFLICT.
export function noteRevision(note: NoteRecord): string {
  return revision({
    id: note.id,
    name: note.name,
    folderId: note.folder?.id ?? null,
    tags: note.tags.map(({ id, name }) => ({ id, name })),
    content: note.content,
    isDeleted: note.isDeleted,
  })
}

export function snippetRevision(snippet: SnippetRecord): string {
  return revision({
    id: snippet.id,
    name: snippet.name,
    folderId: snippet.folder?.id ?? null,
    tags: snippet.tags.map(({ id, name }) => ({ id, name })),
    contents: snippet.contents.map(({ id, label, language, value }) => ({
      id,
      label,
      language,
      value,
    })),
    isDeleted: snippet.isDeleted,
  })
}

export function contentBytes(item: SnippetRecord | NoteRecord): number {
  return 'contents' in item
    ? item.contents.reduce(
        (size, fragment) =>
          size + Buffer.byteLength(fragment.value ?? '', 'utf8'),
        0,
      )
    : Buffer.byteLength(item.content, 'utf8')
}

export function getVaultItem(
  type: 'note',
  id: number,
  checkContentSize?: boolean,
): NoteRecord & { type: 'note', contentRevision: string }
export function getVaultItem(
  type: 'snippet',
  id: number,
  checkContentSize?: boolean,
): SnippetRecord & { type: 'snippet', contentRevision: string }
export function getVaultItem(
  type: VaultType,
  id: number,
  checkContentSize?: boolean,
): (NoteRecord | SnippetRecord) & { type: VaultType, contentRevision: string }
export function getVaultItem(
  type: VaultType,
  id: number,
  checkContentSize = true,
) {
  const item
    = type === 'snippet'
      ? useStorage().snippets.getSnippetById(id)
      : useNotesStorage().notes.getNoteById(id)
  if (!item || item.isDeleted) {
    throw new Error(
      type === 'snippet' ? 'SNIPPET_NOT_FOUND' : 'NOTE_NOT_FOUND',
    )
  }
  if (item.pendingCloudDownload) {
    throw new Error('CLOUD_FILE_NOT_DOWNLOADED')
  }
  if (checkContentSize && contentBytes(item) > CONTENT_LIMIT) {
    throw new Error('CONTENT_TOO_LARGE')
  }
  return {
    type,
    ...item,
    contentRevision:
      'contents' in item ? snippetRevision(item) : noteRevision(item),
  }
}

export function vaultFolders(type: VaultType) {
  return type === 'snippet'
    ? useStorage().folders.getFolders()
    : useNotesStorage().folders.getFolders()
}

export function vaultTags(type: VaultType) {
  return type === 'snippet' ? useStorage().tags : useNotesStorage().tags
}

/**
 * Заменяет набор тегов записи целиком, создавая недостающие теги.
 * createdTags заполняется по ходу, чтобы вызывающий видел созданные теги
 * и при исключении на середине.
 */
export function applyTagNames(
  type: VaultType,
  item: { id: number, tags: TagRecord[] },
  names: string[],
  createdTags: string[] = [],
): { tags: TagRecord[], createdTags: string[] } {
  const tagsStorage = vaultTags(type)
  const allTags = tagsStorage.getTags()
  // В vault бывают теги, различающиеся только регистром: сначала берём уже
  // привязанный к записи, затем точное совпадение, иначе запись сменит тег на дубль.
  const findTag = (name: string, key: string) =>
    item.tags.find(tag => tag.name.toLocaleLowerCase() === key)
    ?? allTags.find(tag => tag.name === name)
    ?? allTags.find(tag => tag.name.toLocaleLowerCase() === key)

  const tags: TagRecord[] = []
  const seen = new Set<string>()
  for (const raw of names) {
    const name = raw.trim()
    const key = name.toLocaleLowerCase()
    if (!name || seen.has(key))
      continue
    seen.add(key)
    const found = findTag(name, key)
    let tag = found && { id: found.id, name: found.name }
    if (!tag) {
      tag = { id: tagsStorage.createTag(name).id, name }
      createdTags.push(name)
    }
    tags.push(tag)
  }

  const notFound = type === 'snippet' ? 'SNIPPET_NOT_FOUND' : 'NOTE_NOT_FOUND'
  const nextIds = new Set(tags.map(tag => tag.id))
  const currentIds = new Set(item.tags.map(tag => tag.id))
  for (const tag of item.tags) {
    if (nextIds.has(tag.id))
      continue
    const removed
      = type === 'snippet'
        ? useStorage().snippets.deleteTagFromSnippet(item.id, tag.id).snippetFound
        : useNotesStorage().notes.deleteTagFromNote(item.id, tag.id).noteFound
    if (!removed)
      throw new Error(notFound)
  }
  for (const tag of tags) {
    if (currentIds.has(tag.id))
      continue
    const added
      = type === 'snippet'
        ? useStorage().snippets.addTagToSnippet(item.id, tag.id)
        : useNotesStorage().notes.addTagToNote(item.id, tag.id)
    const itemFound
      = 'snippetFound' in added ? added.snippetFound : added.noteFound
    if (!itemFound)
      throw new Error(notFound)
    if (!added.tagFound)
      throw new Error('STORAGE_ERROR')
  }

  return { tags, createdTags }
}

const INVALID_NAME_MESSAGES: Record<EntryNameValidationIssue['code'], string>
  = {
    empty: 'The name is empty.',
    leadingDot:
      'The name cannot start with a dot: it would become a hidden file in the vault.',
    invalidChars: '',
    trailingDot: 'The name cannot end with a dot.',
    windowsReserved:
      'The name is reserved on Windows (CON, PRN, AUX, NUL, COM1-9, LPT1-9).',
  }

export function invalidNameFailure(
  issue: EntryNameValidationIssue,
): CallToolResult {
  if (issue.code === 'invalidChars') {
    return failure(
      'INVALID_NAME',
      `The name contains forbidden characters: ${formatEntryNameValidationChars(issue.chars)}. Names are vault file names: # < > : " / \\ [ ] ^ | ? * and control characters are not allowed; # [ ] ^ | are reserved by wiki-link syntax.`,
      false,
      { reason: issue.code, invalidChars: issue.chars },
    )
  }
  return failure('INVALID_NAME', INVALID_NAME_MESSAGES[issue.code], false, {
    reason: issue.code,
  })
}

export function editingDisabled(): CallToolResult | undefined {
  if (store.preferences.get('api.mcp.allowEdits') !== true) {
    return failure(
      'EDITING_DISABLED',
      'Modifying existing items is disabled. Enable "Allow MCP to modify existing items" in massCode Preferences → API.',
    )
  }
}

export function nameConflictFailure(
  type: VaultType,
  name: string,
  folderId: number | null,
): CallToolResult {
  let folderName: string | null = null
  try {
    folderName
      = folderId === null
        ? null
        : (vaultFolders(type).find(folder => folder.id === folderId)?.name
          ?? null)
  }
  catch {}
  return failure(
    'NAME_CONFLICT',
    `A ${type} named "${name}" already exists in ${folderName ?? 'Inbox'}.`,
    false,
    { folderId, folderName },
  )
}

/** Нормализованный код ошибки без текста исходного исключения (там бывают пути). */
export function failureCode(error: unknown): string {
  const text = storageFailure(error).content[0]
  return text.type === 'text' ? JSON.parse(text.text).code : 'STORAGE_ERROR'
}
