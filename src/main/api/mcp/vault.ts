import type { CallToolResult, McpServer } from '@modelcontextprotocol/server'
import type {
  InternalLinkLookupItem,
  InternalLinkType,
} from '../../../shared/notes/internalLinks'
import type { SnippetContentUpdateInput } from '../../storage/contracts'
import type { VaultType } from './vaultItems'
import { Buffer } from 'node:buffer'
import { z } from 'zod'
import { getEntryNameValidationIssue } from '../../../shared/entryNameValidation'
import { buildNoteFolderPathMap } from '../../../shared/notes/folderPath'
import { findInternalLinks } from '../../../shared/notes/internalLinks'
import { NOTES_LINK_GUIDANCE } from '../../ai/instructions'
import { useHttpStorage, useNotesStorage, useStorage } from '../../storage'
import { PartialCreateError } from '../../storage/partialCreateError'
import { createInternalLinkResolver } from '../../storage/providers/markdown/notes/runtime/internalLinkResolver'
import { getHttpItem } from './httpItems'
import {
  CONTENT_LIMIT,
  failure,
  notifyStorageSynced,
  result,
  safely,
  storageFailure,
} from './results'
import {
  applyTagNames,
  editingDisabled,
  failureCode,
  getVaultItem,
  invalidNameFailure,
  nameConflictFailure,
  vaultFolders,
  vaultTags,
} from './vaultItems'

export const idSchema = z
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER)
export const nameSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .describe(
    'Item name, also used as its vault file name. Forbidden: # < > : " / \\ [ ] ^ | ? * and control characters, a leading or trailing dot, and Windows reserved names (CON, PRN, AUX, NUL, COM1-9, LPT1-9).',
  )
export const folderIdSchema = idSchema
  .nullable()
  .describe('Folder ID from list_structure; null means Inbox.')
const tagsSchema = z
  .array(z.string().trim().min(1).max(255))
  .max(50)
  .describe('Tag names, matched case-insensitively; missing tags are created.')
const languageSchema = z
  .string()
  .regex(/^[^\r\n`]+$/, 'Language must be a single line without backticks.')
  .trim()
  .min(1)
  .max(128)
const revisionSchema = z
  .string()
  .min(1)
  .describe('contentRevision from the latest get_item result.')
export const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
}
export const createAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
}
export const editAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
}
const nonempty = (patch: object) => Object.keys(patch).length > 0
const notePatchSchema = z
  .object({
    name: nameSchema.optional(),
    folderId: folderIdSchema.optional(),
    tags: tagsSchema.optional(),
    content: z.string().optional(),
  })
  .strict()
  .refine(nonempty, 'Provide at least one field')
const snippetPatchSchema = z
  .object({
    name: nameSchema.optional(),
    folderId: folderIdSchema.optional(),
    tags: tagsSchema.optional(),
    fragment: z
      .object({
        contentId: idSchema.optional(),
        content: z.string().optional(),
        language: languageSchema.optional(),
        label: z.string().max(255).optional(),
      })
      .strict()
      .refine(
        fragment =>
          fragment.content !== undefined
          || fragment.language !== undefined
          || fragment.label !== undefined,
        'Provide content, language or label',
      )
      .optional(),
  })
  .strict()
  .refine(nonempty, 'Provide at least one field')

const STALE_REVISION_MESSAGE
  = 'The item changed. Read it again with get_item and reconcile before retrying.'
export const EDIT_PERMISSION_NOTE
  = 'Requires "Allow MCP to modify existing items" in massCode Preferences.'
const AUTOSAVE_NOTE
  = 'If the item is open in massCode with unsaved typing, the app autosave may overwrite this edit; read it again to verify.'

type NotePatch = z.infer<typeof notePatchSchema>
type SnippetPatch = z.infer<typeof snippetPatchSchema>

export function folderExists(type: VaultType, folderId: number): boolean {
  return vaultFolders(type).some(folder => folder.id === folderId)
}

function savedItem(type: VaultType, id: number, createdTags: string[]) {
  const item = getVaultItem(type, id, false)
  return {
    type,
    id,
    name: item.name,
    folderId: item.folder?.id ?? null,
    tags: item.tags.map(({ id, name }) => ({ id, name })),
    createdTags,
    contentRevision: item.contentRevision,
  }
}

function createItem(
  type: VaultType,
  input: {
    name: string
    content: string
    language?: string
    folderId?: number | null
    tags?: string[]
  },
): CallToolResult {
  const issue = getEntryNameValidationIssue(input.name)
  if (issue) {
    return invalidNameFailure(issue)
  }
  if (Buffer.byteLength(input.content, 'utf8') > CONTENT_LIMIT) {
    return failure('CONTENT_TOO_LARGE', 'Content exceeds the 256 KiB limit.')
  }
  const folderId = input.folderId ?? null
  try {
    if (folderId !== null && !folderExists(type, folderId)) {
      throw new Error('FOLDER_NOT_FOUND')
    }
  }
  catch (error) {
    return storageFailure(error)
  }

  let id: number | undefined
  const createdTags: string[] = []
  try {
    if (type === 'snippet') {
      const { snippets } = useStorage()
      id = snippets.createSnippet({ name: input.name, folderId }).id
      snippets.createSnippetContent(id, {
        label: input.name,
        language: input.language ?? 'plain_text',
        value: input.content,
      })
    }
    else {
      const { notes } = useNotesStorage()
      id = notes.createNote({ name: input.name, folderId }).id
      const update = notes.updateNoteContent(id, input.content)
      if (update.invalidInput || update.notFound) {
        throw new Error('STORAGE_ERROR')
      }
    }
    if (input.tags) {
      applyTagNames(type, { id, tags: [] }, input.tags, createdTags)
    }
    return result(savedItem(type, id, createdTags))
  }
  catch (error) {
    if (error instanceof PartialCreateError) {
      id = error.itemId
    }
    if (id !== undefined) {
      return failure(
        'PARTIAL_CREATE',
        'The item was created, but saving did not complete. Inspect this item; do not retry creation automatically.',
        false,
        { type, id, ...(createdTags.length > 0 && { createdTags }) },
      )
    }
    if (failureCode(error) === 'NAME_CONFLICT') {
      return nameConflictFailure(type, input.name.trim(), folderId)
    }
    return storageFailure(error)
  }
  finally {
    if (id !== undefined) {
      notifyStorageSynced()
    }
  }
}

type UpdateStep = 'metadata' | 'content' | 'tags'

function updateItem(
  type: VaultType,
  id: number,
  expectedRevision: string,
  patch: NotePatch | SnippetPatch,
): CallToolResult {
  const disabled = editingDisabled()
  if (disabled) {
    return disabled
  }

  // Все проверки до первой записи: отказ здесь ничего не меняет в vault.
  let item: ReturnType<typeof getVaultItem>
  try {
    item = getVaultItem(type, id, false)
    if (patch.folderId != null && !folderExists(type, patch.folderId)) {
      throw new Error('FOLDER_NOT_FOUND')
    }
  }
  catch (error) {
    return storageFailure(error)
  }
  if (item.contentRevision !== expectedRevision) {
    return failure('CONFLICT', STALE_REVISION_MESSAGE)
  }
  if (patch.name !== undefined) {
    const issue = getEntryNameValidationIssue(patch.name)
    if (issue) {
      return invalidNameFailure(issue)
    }
  }

  let writeContent: (() => void) | undefined
  if ('content' in item && 'content' in patch && patch.content !== undefined) {
    const content = patch.content
    if (Buffer.byteLength(content, 'utf8') > CONTENT_LIMIT) {
      return storageFailure(new Error('CONTENT_TOO_LARGE'))
    }
    writeContent = () => {
      const updated = useNotesStorage().notes.updateNoteContent(id, content)
      if (updated.notFound) {
        throw new Error('NOTE_NOT_FOUND')
      }
    }
  }
  if ('contents' in item && 'fragment' in patch && patch.fragment) {
    const { contentId, content, language, label } = patch.fragment
    if (item.contents.length === 0) {
      return failure('NOT_FOUND', 'The snippet has no fragments to edit.')
    }
    if (contentId === undefined && item.contents.length !== 1) {
      return failure(
        'FRAGMENT_AMBIGUOUS',
        `Pass fragment.contentId: the snippet has ${item.contents.length} fragments.`,
      )
    }
    const target
      = contentId === undefined
        ? item.contents[0]
        : item.contents.find(fragment => fragment.id === contentId)
    if (!target) {
      return failure(
        'NOT_FOUND',
        'Fragment not found. Read the snippet with get_item to get fragment IDs.',
      )
    }
    const size = item.contents.reduce(
      (total, fragment) =>
        total
        + Buffer.byteLength(
          (fragment === target && content !== undefined
            ? content
            : fragment.value) ?? '',
          'utf8',
        ),
      0,
    )
    if (size > CONTENT_LIMIT) {
      return storageFailure(new Error('CONTENT_TOO_LARGE'))
    }
    const changes: SnippetContentUpdateInput = {}
    if (content !== undefined)
      changes.value = content
    if (language !== undefined)
      changes.language = language
    if (label !== undefined)
      changes.label = label
    writeContent = () => {
      const updated = useStorage().snippets.updateSnippetContent(
        id,
        target.id,
        changes,
      )
      if (updated.notFound || updated.parentNotFound) {
        throw new Error('SNIPPET_NOT_FOUND')
      }
      if (updated.invalidInput) {
        throw new Error('STORAGE_ERROR')
      }
    }
  }

  const metadata: { name?: string, folderId?: number | null } = {}
  if (patch.name !== undefined)
    metadata.name = patch.name
  if (patch.folderId !== undefined)
    metadata.folderId = patch.folderId

  // Запись синхронна от чтения ревизии до конца: между проверкой и записью
  // нет await, поэтому другой MCP-вызов не вклинится.
  const applied: UpdateStep[] = []
  const createdTags: string[] = []
  let step: UpdateStep | 'readback' = 'metadata'
  let changed = false
  try {
    if (Object.keys(metadata).length) {
      step = 'metadata'
      const updated
        = type === 'snippet'
          ? useStorage().snippets.updateSnippet(id, metadata)
          : useNotesStorage().notes.updateNote(id, metadata)
      if (updated.notFound) {
        throw new Error(
          type === 'snippet' ? 'SNIPPET_NOT_FOUND' : 'NOTE_NOT_FOUND',
        )
      }
      if (updated.invalidInput) {
        throw new Error('STORAGE_ERROR')
      }
      applied.push(step)
    }
    if (writeContent) {
      step = 'content'
      writeContent()
      applied.push(step)
    }
    if (patch.tags) {
      step = 'tags'
      applyTagNames(type, item, patch.tags, createdTags)
      applied.push(step)
    }
    changed = applied.length > 0
    step = 'readback'
    return result(savedItem(type, id, createdTags))
  }
  catch (error) {
    let contentRevision: string | null = null
    try {
      contentRevision = getVaultItem(type, id, false).contentRevision
    }
    catch {}
    // Шаг тегов состоит из нескольких операций и может упасть посередине,
    // поэтому частичную запись определяем и по созданным тегам, и по смене ревизии.
    changed
      = applied.length > 0
        || createdTags.length > 0
        || contentRevision !== item.contentRevision
    if (!changed) {
      if (failureCode(error) === 'NAME_CONFLICT') {
        return nameConflictFailure(
          type,
          (patch.name ?? item.name).trim(),
          item.folder?.id ?? null,
        )
      }
      return storageFailure(error)
    }
    // Сбой на шаге content не гарантирует, что файл не изменился: запись могла
    // пройти частично, а у сниппета упасть уже сохранение state после записи.
    const message
      = step === 'readback'
        ? 'All changes were saved, but reading the item back failed. Read it again with get_item.'
        : step === 'content'
          ? 'The item was partly updated. The content change may not be saved. Resend the same content or fragment patch with the returned contentRevision.'
          : 'The item was partly updated. Read it again before retrying.'
    return failure('PARTIAL_UPDATE', message, false, {
      type,
      id,
      applied,
      failed: step,
      cause: failureCode(error),
      contentRevision,
      createdTags,
      ...(step === 'content' && { persisted: false }),
    })
  }
  finally {
    if (changed) {
      notifyStorageSynced()
    }
  }
}

function trashItem(
  type: VaultType | 'http_request',
  id: number,
  expectedRevision: string,
): CallToolResult {
  const disabled = editingDisabled()
  if (disabled) {
    return disabled
  }
  try {
    if (type === 'http_request') {
      if (getHttpItem(id, false).contentRevision !== expectedRevision) {
        return failure('CONFLICT', STALE_REVISION_MESSAGE)
      }
      const updated = useHttpStorage().requests.updateRequest(id, {
        isDeleted: 1,
        folderId: null,
        expectedRevision,
      })
      if (updated.notFound) {
        throw new Error('HTTP_REQUEST_NOT_FOUND')
      }
      if (updated.invalidInput) {
        throw new Error('STORAGE_ERROR')
      }
    }
    else {
      if (getVaultItem(type, id, false).contentRevision !== expectedRevision) {
        return failure('CONFLICT', STALE_REVISION_MESSAGE)
      }
      const updated
        = type === 'snippet'
          ? useStorage().snippets.updateSnippet(id, {
              isDeleted: 1,
              folderId: null,
            })
          : useNotesStorage().notes.updateNote(id, {
              isDeleted: 1,
              folderId: null,
            })
      if (updated.notFound) {
        throw new Error(
          type === 'snippet' ? 'SNIPPET_NOT_FOUND' : 'NOTE_NOT_FOUND',
        )
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
  return result({ type, id, trashed: true })
}

function mcpLinkType(type: InternalLinkType) {
  return type === 'http-request' ? 'http_request' : type
}

async function getNoteLinks(id: number) {
  const note = getVaultItem('note', id, false)
  const { notes, folders } = useNotesStorage()
  const httpStorage = useHttpStorage()
  const query = { isDeleted: 0, withContent: true }
  const allNotes = (
    notes.getNotesAsync
      ? await notes.getNotesAsync(query)
      : notes.getNotes(query)
  ).filter(item => !item.isDeleted)
  const snippets = useStorage()
    .snippets
    .getSnippets({ isDeleted: 0 })
    .filter(item => !item.isDeleted)
  const requests = httpStorage.requests
    .getRequests({ isDeleted: 0 })
    .filter(item => !item.isDeleted)

  const noteFolderPathById = buildNoteFolderPathMap(folders.getFolders())
  const httpFolderPathById = buildNoteFolderPathMap(
    httpStorage.folders.getFolders(),
  )
  const notePath = (folderId: number | undefined) =>
    folderId === undefined ? undefined : noteFolderPathById.get(folderId)
  const resolver = createInternalLinkResolver([
    ...snippets.map<InternalLinkLookupItem>(snippet => ({
      id: snippet.id,
      name: snippet.name,
      type: 'snippet',
    })),
    ...allNotes.map<InternalLinkLookupItem>(item => ({
      folderPath: notePath(item.folder?.id),
      id: item.id,
      name: item.name,
      type: 'note',
    })),
    ...requests.map<InternalLinkLookupItem>(request => ({
      folderPath:
        request.folderId === null
          ? ''
          : (httpFolderPathById.get(request.folderId) ?? ''),
      id: request.id,
      name: request.name,
      type: 'http-request',
    })),
  ])
  const existingIds: Record<InternalLinkType, Set<number>> = {
    'snippet': new Set(snippets.map(item => item.id)),
    'note': new Set(allNotes.map(item => item.id)),
    'http-request': new Set(requests.map(item => item.id)),
  }

  const outgoing = []
  const seen = new Set<string>()
  const linkerFolderPath = notePath(note.folder?.id)
  for (const link of findInternalLinks(note.content)) {
    if (seen.has(link.raw))
      continue
    seen.add(link.raw)
    const base = { label: link.label, raw: link.raw }
    if (link.plannedTarget) {
      outgoing.push({
        type: mcpLinkType(link.plannedTarget.type),
        id: null,
        ...base,
        status: 'planned' as const,
      })
      continue
    }
    const target
      = link.legacyTarget ?? resolver.resolve(link.target, { linkerFolderPath })
    if (!target) {
      outgoing.push({
        type: null,
        id: null,
        ...base,
        status: 'missing' as const,
      })
      continue
    }
    outgoing.push({
      type: mcpLinkType(target.type),
      id: target.id,
      ...base,
      status: existingIds[target.type].has(target.id)
        ? ('resolved' as const)
        : ('missing' as const),
    })
  }

  const incoming = []
  let skippedPendingNotes = 0
  for (const other of allNotes) {
    if (other.id === id)
      continue
    if (other.pendingCloudDownload) {
      skippedPendingNotes += 1
      continue
    }
    const otherFolderPath = notePath(other.folder?.id)
    const linksHere = findInternalLinks(other.content).some((link) => {
      if (link.plannedTarget)
        return false
      const target
        = link.legacyTarget
          ?? resolver.resolve(link.target, { linkerFolderPath: otherFolderPath })
      return target?.type === 'note' && target.id === id
    })
    if (linksHere) {
      incoming.push({
        id: other.id,
        name: other.name,
        folderId: other.folder?.id ?? null,
      })
    }
  }

  return { id, outgoing, incoming, skippedPendingNotes }
}

export function registerVaultTools(server: McpServer) {
  server.registerTool(
    'get_item',
    {
      description:
        'Get a complete local note, snippet with all fragments, or saved HTTP request, up to 256 KiB of combined UTF-8 content and 2 MiB of result JSON. IDs are scoped by type. Trash is excluded. Every item includes contentRevision: pass it as expectedRevision to update or trash tools. Cloud placeholders return a retryable error; oversized results are never truncated.',
      inputSchema: {
        type: z.enum(['snippet', 'note', 'http_request']),
        id: idSchema,
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ type, id }) =>
      safely(() =>
        type === 'http_request' ? getHttpItem(id) : getVaultItem(type, id),
      ),
  )

  server.registerTool(
    'list_structure',
    {
      description:
        'List folders (id, name, parentId) and tags (id, name) of the Code (snippets) or Notes space. Use folder IDs as folderId when creating, updating or moving notes and snippets. Code and Notes have separate folders and tags.',
      inputSchema: { space: z.enum(['code', 'notes']) },
      annotations: readOnly,
    },
    ({ space }) =>
      safely(() => {
        const type = space === 'code' ? 'snippet' : 'note'
        return {
          folders: vaultFolders(type).map(({ id, name, parentId }) => ({
            id,
            name,
            parentId,
          })),
          tags: vaultTags(type)
            .getTags()
            .map(({ id, name }) => ({ id, name })),
        }
      }),
  )

  server.registerTool(
    'create_snippet',
    {
      description:
        'Create one snippet with one fragment. Omit folderId or pass null for Inbox; get folder IDs from list_structure (code). tags are matched case-insensitively and missing tags are created. Content is preserved exactly, up to 256 KiB in UTF-8. Returns actual name, folderId, tags, createdTags and contentRevision. On PARTIAL_CREATE inspect the returned item ID and do not retry creation.',
      inputSchema: {
        name: nameSchema,
        content: z.string(),
        language: languageSchema.default('plain_text'),
        folderId: folderIdSchema.optional(),
        tags: tagsSchema.optional(),
      },
      annotations: createAnnotations,
    },
    input => createItem('snippet', input),
  )

  server.registerTool(
    'create_note',
    {
      description: `Create one Markdown note. Omit folderId or pass null for Inbox; get folder IDs from list_structure (notes). tags are matched case-insensitively and missing tags are created. Content is preserved exactly, up to 256 KiB in UTF-8. Returns actual name, folderId, tags, createdTags and contentRevision. On PARTIAL_CREATE inspect the returned item ID and do not retry creation. ${NOTES_LINK_GUIDANCE} Prefer [[note:ID|Label]] for existing notes: IDs stay stable across renames.`,
      inputSchema: {
        name: nameSchema,
        content: z.string(),
        folderId: folderIdSchema.optional(),
        tags: tagsSchema.optional(),
      },
      annotations: createAnnotations,
    },
    input => createItem('note', input),
  )

  server.registerTool(
    'update_snippet',
    {
      description: `Update an existing snippet. Read get_item first and pass its contentRevision as expectedRevision; a stale revision returns CONFLICT. Patch must be nonempty: omitted fields remain unchanged, tags replace the whole set (missing tags are created), folderId null moves to Inbox. fragment edits one fragment (content, language, label); fragment.contentId is required when the snippet has several fragments. Renaming a snippet does not update [[Title]] links in notes; prefer [[snippet:ID|Label]]. Combined final content must fit 256 KiB UTF-8. Returns actual name, folderId, tags and new contentRevision; on PARTIAL_UPDATE read the item again before retrying. ${AUTOSAVE_NOTE} ${EDIT_PERMISSION_NOTE}`,
      inputSchema: {
        id: idSchema,
        expectedRevision: revisionSchema,
        patch: snippetPatchSchema,
      },
      annotations: editAnnotations,
    },
    ({ id, expectedRevision, patch }) =>
      updateItem('snippet', id, expectedRevision, patch),
  )

  server.registerTool(
    'update_note',
    {
      description: `Update an existing note. Read get_item first and pass its contentRevision as expectedRevision; a stale revision returns CONFLICT. Patch must be nonempty: omitted fields remain unchanged, content replaces the whole Markdown body, tags replace the whole set (missing tags are created), folderId null moves to Inbox. Renaming or moving rewrites [[Title]] links in other notes (their revisions change) but not [[note:ID]] links. Content must fit 256 KiB UTF-8. Returns actual name, folderId, tags and new contentRevision; on PARTIAL_UPDATE read the item again before retrying. ${AUTOSAVE_NOTE} ${EDIT_PERMISSION_NOTE} ${NOTES_LINK_GUIDANCE}`,
      inputSchema: {
        id: idSchema,
        expectedRevision: revisionSchema,
        patch: notePatchSchema,
      },
      annotations: editAnnotations,
    },
    ({ id, expectedRevision, patch }) =>
      updateItem('note', id, expectedRevision, patch),
  )

  server.registerTool(
    'trash_item',
    {
      description: `Move a snippet, note or saved HTTP request to Trash. Read get_item first and pass its contentRevision as expectedRevision; a stale revision returns CONFLICT. Never deletes permanently: the user can restore the item from Trash in massCode. ${EDIT_PERMISSION_NOTE}`,
      inputSchema: {
        type: z.enum(['snippet', 'note', 'http_request']),
        id: idSchema,
        expectedRevision: revisionSchema,
      },
      annotations: editAnnotations,
    },
    ({ type, id, expectedRevision }) => trashItem(type, id, expectedRevision),
  )

  server.registerTool(
    'get_note_links',
    {
      description:
        'List wiki links of a note. outgoing: unique links in its content with type, id, label, raw and status (resolved, missing or planned). incoming: notes outside Trash that link to it by title, path or [[note:ID]]. Notes whose content is not downloaded yet are skipped and counted in skippedPendingNotes.',
      inputSchema: { id: idSchema },
      annotations: readOnly,
    },
    ({ id }) => safely(() => getNoteLinks(id)),
  )
}
