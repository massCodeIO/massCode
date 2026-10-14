import type { CallToolResult, McpServer } from '@modelcontextprotocol/server'
import type { VaultType } from './vaultItems'
import { z } from 'zod'
import { getEntryNameValidationIssue } from '../../../shared/entryNameValidation'
import { useHttpStorage, useNotesStorage, useStorage } from '../../storage'
import { getHttpItem } from './httpItems'
import {
  failure,
  notifyStorageSynced,
  result,
  safely,
  storageFailure,
} from './results'
import {
  createAnnotations,
  EDIT_PERMISSION_NOTE,
  editAnnotations,
  folderExists,
  idSchema,
  nameSchema,
  readOnly,
} from './vault'
import {
  editingDisabled,
  failureCode,
  getVaultItem,
  invalidNameFailure,
  vaultFolders,
  vaultMetadata,
} from './vaultItems'

type Space = 'code' | 'notes'

const spaceSchema = z.enum(['code', 'notes'])
const parentIdSchema = idSchema
  .nullable()
  .describe('Parent folder ID from list_structure; null means the space root.')
const targetFolderIdSchema = idSchema
  .nullable()
  .describe('Folder ID from list_structure; null means Inbox.')

function spaceType(space: Space): VaultType {
  return space === 'code' ? 'snippet' : 'note'
}

function folderStorage(type: VaultType) {
  return type === 'snippet' ? useStorage().folders : useNotesStorage().folders
}

function itemNotFoundCode(type: VaultType) {
  return type === 'snippet' ? 'SNIPPET_NOT_FOUND' : 'NOTE_NOT_FOUND'
}

function folderNameConflictFailure(
  space: Space,
  name: string,
  parentId: number | null,
): CallToolResult {
  let parentName: string | null = null
  try {
    parentName
      = parentId === null
        ? null
        : (vaultFolders(spaceType(space)).find(
            folder => folder.id === parentId,
          )?.name ?? null)
  }
  catch {}
  return failure(
    'NAME_CONFLICT',
    `A folder named "${name}" already exists in ${parentName ?? 'root'}.`,
    false,
    { parentId, parentName },
  )
}

// Поднимаемся от target к корню: так находится и прямой, и глубокий потомок.
function isInSubtree(
  folders: { id: number, parentId: number | null }[],
  rootId: number,
  targetId: number,
): boolean {
  const parentById = new Map(
    folders.map(folder => [folder.id, folder.parentId]),
  )
  const visited = new Set<number>()
  let current: number | null | undefined = targetId
  while (current != null && !visited.has(current)) {
    if (current === rootId)
      return true
    visited.add(current)
    current = parentById.get(current)
  }
  return false
}

function savedFolder(space: Space, id: number) {
  const folder = vaultFolders(spaceType(space)).find(item => item.id === id)
  if (!folder) {
    throw new Error('FOLDER_NOT_FOUND')
  }
  return { space, id, name: folder.name, parentId: folder.parentId }
}

async function listItems(input: {
  space: Space
  folderId?: number | 'inbox'
  tag?: string
  status: 'active' | 'trash'
  offset: number
  limit: number
}) {
  const type = spaceType(input.space)
  if (
    typeof input.folderId === 'number'
    && !folderExists(type, input.folderId)
  ) {
    throw new Error('FOLDER_NOT_FOUND')
  }
  const isDeleted = input.status === 'trash' ? 1 : 0
  const query = { isDeleted }
  let found
  if (type === 'snippet') {
    const { snippets } = useStorage()
    found = snippets.getSnippetsAsync
      ? await snippets.getSnippetsAsync(query)
      : snippets.getSnippets(query)
  }
  else {
    const { notes } = useNotesStorage()
    found = notes.getNotesAsync
      ? await notes.getNotesAsync(query)
      : notes.getNotes(query)
  }
  const folderId = input.folderId === 'inbox' ? null : input.folderId
  const tag = input.tag?.toLocaleLowerCase()
  const items = found
    .filter(
      item =>
        item.isDeleted === isDeleted
        && (folderId === undefined || (item.folder?.id ?? null) === folderId)
        && (tag === undefined
          || item.tags.some(({ name }) => name.toLocaleLowerCase() === tag)),
    )
    .sort((a, b) => a.id - b.id)
    .map(item => vaultMetadata(type, item))
  const page = items.slice(input.offset, input.offset + input.limit)
  const hasMore = input.offset + page.length < items.length
  return {
    space: input.space,
    status: input.status,
    items: page,
    hasMore,
    nextOffset: hasMore ? input.offset + page.length : null,
  }
}

// Запись уже сделана: сбой перечитывания не должен выглядеть как отказ.
function folderResult(
  space: Space,
  id: number,
  fallback: { name: string, parentId: number | null },
): CallToolResult {
  try {
    return result(savedFolder(space, id))
  }
  catch {
    return result({ space, id, ...fallback })
  }
}

function createFolder(
  space: Space,
  name: string,
  parentId: number | null,
): CallToolResult {
  const issue = getEntryNameValidationIssue(name)
  if (issue) {
    return invalidNameFailure(issue)
  }
  let id: number
  try {
    id = folderStorage(spaceType(space)).createFolder({ name, parentId }).id
  }
  catch (error) {
    if (failureCode(error) === 'NAME_CONFLICT') {
      return folderNameConflictFailure(space, name, parentId)
    }
    return storageFailure(error)
  }
  notifyStorageSynced()
  return folderResult(space, id, { name, parentId })
}

function updateFolder(
  space: Space,
  id: number,
  patch: { name?: string, parentId?: number | null },
): CallToolResult {
  const disabled = editingDisabled()
  if (disabled) {
    return disabled
  }
  const type = spaceType(space)
  let folders: ReturnType<typeof vaultFolders>
  try {
    folders = vaultFolders(type)
  }
  catch (error) {
    return storageFailure(error)
  }
  const folder = folders.find(item => item.id === id)
  if (!folder) {
    return storageFailure(new Error('FOLDER_NOT_FOUND'))
  }
  if (patch.name !== undefined) {
    const issue = getEntryNameValidationIssue(patch.name)
    if (issue) {
      return invalidNameFailure(issue)
    }
  }
  if (patch.parentId != null) {
    if (isInSubtree(folders, id, patch.parentId)) {
      return failure(
        'INVALID_PARENT',
        'A folder cannot be moved into itself or its own subtree.',
      )
    }
    if (!folders.some(item => item.id === patch.parentId)) {
      return storageFailure(new Error('FOLDER_NOT_FOUND'))
    }
  }

  const changes: { name?: string, parentId?: number | null } = {}
  if (patch.name !== undefined)
    changes.name = patch.name
  if (patch.parentId !== undefined)
    changes.parentId = patch.parentId
  const target = {
    name: patch.name ?? folder.name,
    parentId: patch.parentId !== undefined ? patch.parentId : folder.parentId,
  }
  try {
    const updated = folderStorage(type).updateFolder(id, changes)
    if (updated.notFound) {
      throw new Error('FOLDER_NOT_FOUND')
    }
    if (updated.invalidInput) {
      throw new Error('STORAGE_ERROR')
    }
  }
  catch (error) {
    if (failureCode(error) === 'NAME_CONFLICT') {
      return folderNameConflictFailure(space, target.name, target.parentId)
    }
    return storageFailure(error)
  }
  notifyStorageSynced()
  // При переносе storage может выбрать свободное имя: возвращаем фактическое.
  return folderResult(space, id, target)
}

function deleteFolder(space: Space, id: number): CallToolResult {
  const disabled = editingDisabled()
  if (disabled) {
    return disabled
  }
  const type = spaceType(space)
  // Проверка пустоты и удаление идут без await: другой вызов не вклинится
  // и не положит запись в папку между ними.
  try {
    const folders = vaultFolders(type)
    if (!folders.some(folder => folder.id === id)) {
      throw new Error('FOLDER_NOT_FOUND')
    }
    const subfolders = folders.filter(
      folder => folder.parentId === id,
    ).length
    // Записи в корзине не лежат в каталоге папки и удаление не блокируют.
    const query = { folderId: id, isDeleted: 0 }
    const found
      = type === 'snippet'
        ? useStorage().snippets.getSnippets(query)
        : useNotesStorage().notes.getNotes(query)
    const items = found.filter(
      item => !item.isDeleted && item.folder?.id === id,
    ).length
    if (subfolders > 0 || items > 0) {
      return failure(
        'FOLDER_NOT_EMPTY',
        'Move or trash its items and subfolders first.',
        false,
        { subfolders, items },
      )
    }
    // Storage удаляет каталог папки целиком: посторонние файлы в нём
    // пропали бы безвозвратно. До сверки vault здесь будет VAULT_HYDRATING.
    const files = folderStorage(type).getUnmanagedFiles(id).length
    if (files > 0) {
      return failure(
        'FOLDER_NOT_EMPTY',
        'The folder directory contains files that massCode does not manage. Move or remove them outside massCode first.',
        false,
        { subfolders, items, files },
      )
    }
    if (!folderStorage(type).deleteFolder(id).deleted) {
      throw new Error('FOLDER_NOT_FOUND')
    }
  }
  catch (error) {
    return storageFailure(error)
  }
  notifyStorageSynced()
  return result({ space, id, deleted: true })
}

function readVaultItem(type: VaultType, id: number) {
  return type === 'snippet'
    ? useStorage().snippets.getSnippetById(id)
    : useNotesStorage().notes.getNoteById(id)
}

function moveItems(
  space: Space,
  ids: number[],
  folderId: number | null,
): CallToolResult {
  const disabled = editingDisabled()
  if (disabled) {
    return disabled
  }
  const type = spaceType(space)
  try {
    if (folderId !== null && !folderExists(type, folderId)) {
      throw new Error('FOLDER_NOT_FOUND')
    }
  }
  catch (error) {
    return storageFailure(error)
  }

  const results: (
    | { id: number, ok: true, name: string }
    | { id: number, ok: false, error: string }
  )[] = []
  let written = false
  for (const id of new Set(ids)) {
    let item: ReturnType<typeof getVaultItem>
    try {
      item = getVaultItem(type, id, false)
    }
    catch (error) {
      results.push({ id, ok: false, error: failureCode(error) })
      continue
    }
    if ((item.folder?.id ?? null) === folderId) {
      results.push({ id, ok: true, name: item.name })
      continue
    }
    try {
      const updated
        = type === 'snippet'
          ? useStorage().snippets.updateSnippet(id, { folderId })
          : useNotesStorage().notes.updateNote(id, { folderId })
      if (updated.notFound) {
        throw new Error(itemNotFoundCode(type))
      }
      if (updated.invalidInput) {
        throw new Error('STORAGE_ERROR')
      }
    }
    catch (error) {
      // Storage может упасть уже после переноса (например, на переписывании
      // ссылок): тогда запись в целевой папке и перенос считается выполненным.
      let saved: ReturnType<typeof readVaultItem> = null
      try {
        saved = readVaultItem(type, id)
      }
      catch {}
      if (
        saved
        && !saved.isDeleted
        && (saved.folder?.id ?? null) === folderId
      ) {
        written = true
        results.push({ id, ok: true, name: saved.name })
      }
      else {
        results.push({ id, ok: false, error: failureCode(error) })
      }
      continue
    }
    written = true
    let name = item.name
    try {
      name = readVaultItem(type, id)?.name ?? item.name
    }
    catch {}
    results.push({ id, ok: true, name })
  }
  if (written) {
    notifyStorageSynced()
  }
  return result({ space, folderId, results })
}

function restoreItem(
  type: VaultType | 'http_request',
  id: number,
): CallToolResult {
  const disabled = editingDisabled()
  if (disabled) {
    return disabled
  }
  const notFound
    = type === 'http_request' ? 'HTTP_REQUEST_NOT_FOUND' : itemNotFoundCode(type)
  const changes = { isDeleted: 0, folderId: null }
  let name: string
  try {
    if (type === 'http_request') {
      const { requests } = useHttpStorage()
      const request = requests.getRequestById(id)
      if (!request || request.protocol === 'websocket') {
        throw new Error(notFound)
      }
      if (!request.isDeleted) {
        return failure('NOT_IN_TRASH', 'The item is not in Trash.')
      }
      name = request.name
      const updated = requests.updateRequest(id, changes)
      if (updated.notFound) {
        throw new Error(notFound)
      }
      if (updated.invalidInput) {
        throw new Error('STORAGE_ERROR')
      }
    }
    else {
      const item = readVaultItem(type, id)
      if (!item) {
        throw new Error(notFound)
      }
      if (!item.isDeleted) {
        return failure('NOT_IN_TRASH', 'The item is not in Trash.')
      }
      name = item.name
      const updated
        = type === 'snippet'
          ? useStorage().snippets.updateSnippet(id, changes)
          : useNotesStorage().notes.updateNote(id, changes)
      if (updated.notFound) {
        throw new Error(notFound)
      }
      if (updated.invalidInput) {
        throw new Error('STORAGE_ERROR')
      }
    }
  }
  catch (error) {
    return storageFailure(error)
  }
  notifyStorageSynced()
  try {
    const saved
      = type === 'http_request'
        ? getHttpItem(id, false)
        : getVaultItem(type, id, false)
    return result({
      type,
      id,
      name: saved.name,
      folderId: null,
      contentRevision: saved.contentRevision,
    })
  }
  catch {
    return result({
      type,
      id,
      name,
      folderId: null,
      contentRevision: null,
      message: 'Restored, but reading it back failed. Read it with get_item.',
    })
  }
}

export function registerVaultOrganizeTools(server: McpServer) {
  server.registerTool(
    'list_items',
    {
      description:
        'List snippets (code) or notes (notes) as metadata without content, sorted by id ascending. folderId lists direct items of one folder (an unknown folder returns NOT_FOUND); "inbox" lists items without a folder. tag matches a tag name case-insensitively; an unknown tag returns no items. status selects active items or Trash; items in Trash usually have no folder, so filter them by status only.',
      inputSchema: {
        space: spaceSchema,
        folderId: z
          .union([idSchema, z.literal('inbox')])
          .optional()
          .describe('Folder ID from list_structure, or "inbox".'),
        tag: z.string().trim().min(1).max(255).optional(),
        status: z.enum(['active', 'trash']).default('active'),
        offset: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
        limit: z.number().int().min(1).max(100).default(20),
      },
      annotations: readOnly,
    },
    input =>
      safely(
        () => listItems(input),
        'Result JSON exceeds the 2 MiB limit. Reduce limit and retry.',
      ),
  )

  server.registerTool(
    'create_folder',
    {
      description:
        'Create a folder in the Code (snippets) or Notes space. Omit parentId or pass null to create it at the root; get folder IDs from list_structure. Folder names follow the same rules as item names and must be unique among siblings, case-insensitively. Returns the folder id, name and parentId.',
      inputSchema: {
        space: spaceSchema,
        name: nameSchema,
        parentId: parentIdSchema.optional(),
      },
      annotations: createAnnotations,
    },
    ({ space, name, parentId }) => createFolder(space, name, parentId ?? null),
  )

  server.registerTool(
    'update_folder',
    {
      description: `Rename a folder or move it under another parent in the Code or Notes space. Pass name, parentId or both; parentId null moves it to the root. A folder cannot move into itself or its subtree. When moving into a parent that already has a folder with the same name, it is saved under an available name; the response returns the actual name and parentId. Moving or renaming a notes folder rewrites [[Title]] links to its notes in other notes. ${EDIT_PERMISSION_NOTE}`,
      inputSchema: z
        .object({
          space: spaceSchema,
          id: idSchema,
          name: nameSchema.optional(),
          parentId: parentIdSchema.optional(),
        })
        .refine(
          input => input.name !== undefined || input.parentId !== undefined,
          'Provide name or parentId',
        ),
      annotations: editAnnotations,
    },
    ({ space, id, name, parentId }) =>
      updateFolder(space, id, { name, parentId }),
  )

  server.registerTool(
    'delete_folder',
    {
      description: `Delete an empty folder in the Code or Notes space. A folder with subfolders or active items returns FOLDER_NOT_EMPTY with their counts: move or trash them first. Files in the folder directory that massCode does not manage also return FOLDER_NOT_EMPTY with a files count; nothing is deleted permanently. VAULT_HYDRATING is retryable: the vault is still syncing. Items in Trash do not block deletion and stay in Trash. ${EDIT_PERMISSION_NOTE}`,
      inputSchema: { space: spaceSchema, id: idSchema },
      annotations: editAnnotations,
    },
    ({ space, id }) => deleteFolder(space, id),
  )

  server.registerTool(
    'move_items',
    {
      description: `Move up to 100 snippets (code) or notes (notes) into one folder; folderId null moves them to Inbox. Each id gets its own result: ok with the actual name, or an error code such as NOT_FOUND (items in Trash included). An item with a conflicting name in the target folder is saved under an available name. Moving notes rewrites [[Title]] links to them in other notes. For a large library reorganization, prefer the massCode AI assistant: its changes can be reviewed and undone. ${EDIT_PERMISSION_NOTE}`,
      inputSchema: {
        space: spaceSchema,
        ids: z.array(idSchema).min(1).max(100),
        folderId: targetFolderIdSchema,
      },
      annotations: editAnnotations,
    },
    ({ space, ids, folderId }) => moveItems(space, ids, folderId),
  )

  server.registerTool(
    'restore_item',
    {
      description: `Restore a snippet, note or saved HTTP request from Trash to Inbox. Find trashed snippets and notes with list_items and status trash. Find trashed HTTP requests with list_http_requests and status trash. NOT_IN_TRASH means the item is already active. If contentRevision is null, the item was restored but could not be read back: read it with get_item. Returns the actual name and a new contentRevision. ${EDIT_PERMISSION_NOTE}`,
      inputSchema: {
        type: z.enum(['snippet', 'note', 'http_request']),
        id: idSchema,
      },
      annotations: editAnnotations,
    },
    ({ type, id }) => restoreItem(type, id),
  )
}
