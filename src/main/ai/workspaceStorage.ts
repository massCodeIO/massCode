import type { WorkspaceOperation } from '../../shared/aiWorkspace'
import { getEntryNameValidationIssue } from '../../shared/entryNameValidation'
import { emptyHttpCollection } from '../../shared/httpCollection'
import { httpRuntimeSchema } from '../../shared/httpRuntime'
import { useHttpStorage, useNotesStorage, useStorage } from '../storage'

export class WorkspaceFieldError extends Error {
  constructor(readonly allowedFields: string[]) {
    super('UNSUPPORTED_FIELD')
  }
}

export function folders(space: WorkspaceOperation['space']) {
  return space === 'code'
    ? useStorage().folders
    : space === 'notes'
      ? useNotesStorage().folders
      : useHttpStorage().folders
}
export function read(op: WorkspaceOperation) {
  if (!op.id)
    return null
  if (op.kind === 'folder') {
    return (
      folders(op.space)
        .getFolders()
        .find(item => item.id === op.id) ?? null
    )
  }
  return op.space === 'code'
    ? useStorage().snippets.getSnippetById(op.id)
    : op.space === 'notes'
      ? useNotesStorage().notes.getNoteById(op.id)
      : useHttpStorage().requests.getRequestById(op.id)
}
function check(result: unknown) {
  if (
    result
    && typeof result === 'object'
    && (('invalidInput' in result && result.invalidInput)
      || ('notFound' in result && result.notFound))
  ) {
    throw new Error('INVALID_OPERATION')
  }
}
export function validate(op: WorkspaceOperation) {
  const f = op.fields
  if (f.name !== undefined && getEntryNameValidationIssue(f.name))
    throw new Error('INVALID_NAME')
  const allowed
    = op.kind === 'folder'
      ? [
          'name',
          'folderId',
          'folderOperation',
          ...(op.space === 'http' ? ['collection'] : []),
        ]
      : [
          'name',
          'description',
          'isFavorites',
          'isDeleted',
          'folderId',
          'folderOperation',
          ...(op.space === 'http'
            ? [
                'method',
                'url',
                'headers',
                'query',
                'bodyType',
                'body',
                'auth',
                'scripts',
              ]
            : [
                'content',
                'tags',
                ...(op.space === 'code'
                  ? ['language', 'contentId']
                  : ['properties']),
              ]),
        ]
  if (f.folderOperation !== undefined && f.folderId !== undefined)
    throw new Error('AMBIGUOUS_FOLDER')
  if (
    !Object.keys(f).length
    || Object.keys(f).some(key => !allowed.includes(key))
  ) {
    throw new WorkspaceFieldError(allowed)
  }
  if (op.action === 'create' ? op.id !== undefined || !f.name : !op.id)
    throw new Error('INVALID_TARGET')
  if (JSON.stringify(f).includes('[REDACTED]'))
    throw new Error('REDACTED_VALUE')
  const before = read(op)
  if (
    op.action === 'update'
    && (!before
      || ('isDeleted' in before && before.isDeleted)
      || ('pendingCloudDownload' in before && before.pendingCloudDownload))
  ) {
    throw new Error('TARGET_UNAVAILABLE')
  }
  if (
    f.folderId != null
    && !folders(op.space)
      .getFolders()
      .some(item => item.id === f.folderId)
  ) {
    throw new Error('FOLDER_NOT_FOUND')
  }
  if (op.kind === 'folder') {
    let parent = f.folderId
    const all = folders(op.space).getFolders()
    const seen = new Set<number>()
    while (parent != null) {
      if (parent === op.id || seen.has(parent))
        throw new Error('FOLDER_CYCLE')
      seen.add(parent)
      parent = all.find(item => item.id === parent)?.parentId
    }
    if (
      f.collection !== undefined
      && (op.action !== 'create'
        || f.folderId != null
        || f.folderOperation !== undefined)
    ) {
      throw new Error('COLLECTION_ROOT_ONLY')
    }
  }
  if (
    op.space === 'code'
    && op.kind === 'item'
    && op.action === 'update'
    && (f.content !== undefined || f.language !== undefined)
  ) {
    if (
      !f.contentId
      || !before
      || !('contents' in before)
      || !before.contents.some((item: { id: number }) => item.id === f.contentId)
    ) {
      throw new Error('CONTENT_ID_REQUIRED')
    }
  }
  return before
}
function tagNames(space: 'code' | 'notes', id: number, names: string[]) {
  const storage = space === 'code' ? useStorage() : useNotesStorage()
  const record
    = space === 'code'
      ? useStorage().snippets.getSnippetById(id)!
      : useNotesStorage().notes.getNoteById(id)!
  const wanted = new Set(names)
  for (const tag of record.tags) {
    if (!wanted.has(tag.name)) {
      if (space === 'code')
        useStorage().snippets.deleteTagFromSnippet(id, tag.id)
      else useNotesStorage().notes.deleteTagFromNote(id, tag.id)
    }
  }
  for (const name of wanted) {
    if (record.tags.some(tag => tag.name === name))
      continue
    const tag
      = storage.tags.getTags().find(tag => tag.name === name)
        ?? storage.tags.createTag(name)
    if (space === 'code')
      check(useStorage().snippets.addTagToSnippet(id, tag.id))
    else check(useNotesStorage().notes.addTagToNote(id, tag.id))
  }
}
export function write(op: WorkspaceOperation, id: number) {
  const f = op.fields
  if (op.kind === 'folder') {
    check(
      folders(op.space).updateFolder(id, {
        ...(f.name !== undefined ? { name: f.name } : {}),
        ...(f.folderId !== undefined ? { parentId: f.folderId } : {}),
      }),
    )
    if (f.collection) {
      check(
        useHttpStorage().folders.updateFolder(id, {
          collectionConfig: emptyHttpCollection(),
        }),
      )
    }
    return
  }
  const metadata = {
    ...(f.isFavorites !== undefined ? { isFavorites: f.isFavorites } : {}),
    ...(f.isDeleted !== undefined ? { isDeleted: f.isDeleted } : {}),
    ...(f.name !== undefined ? { name: f.name } : {}),
    ...(f.description !== undefined ? { description: f.description } : {}),
    ...(f.folderId !== undefined ? { folderId: f.folderId } : {}),
  }
  if (op.space === 'code') {
    const storage = useStorage().snippets
    if (Object.keys(metadata).length)
      check(storage.updateSnippet(id, metadata))
    if (f.content !== undefined || f.language !== undefined) {
      const contentId
        = f.contentId ?? storage.getSnippetById(id)?.contents[0]?.id
      if (contentId) {
        check(
          storage.updateSnippetContent(id, contentId, {
            ...(f.content !== undefined ? { value: f.content } : {}),
            ...(f.language !== undefined ? { language: f.language } : {}),
          }),
        )
      }
      else {
        storage.createSnippetContent(id, {
          label: 'Fragment',
          language: f.language ?? 'plaintext',
          value: f.content ?? '',
        })
      }
    }
  }
  else if (op.space === 'notes') {
    if (Object.keys(metadata).length)
      check(useNotesStorage().notes.updateNote(id, metadata))
    if (f.properties) {
      const current = useNotesStorage().notes.getNoteById(id)!
      check(
        useNotesStorage().notes.updateNoteProperties(id, {
          properties: f.properties,
          unset: Object.keys(current.properties).filter(
            key => !(key in f.properties!),
          ),
        }),
      )
    }
    if (f.content !== undefined)
      check(useNotesStorage().notes.updateNoteContent(id, f.content))
  }
  else {
    const {
      collection: _collection,
      content: _content,
      contentId: _contentId,
      language: _language,
      tags: _tags,
      folderOperation: _folderOperation,
      properties: _properties,
      scripts,
      ...fields
    } = f
    if (Object.keys(fields).length)
      check(useHttpStorage().requests.updateRequest(id, fields))
    if (scripts) {
      const current = useHttpStorage().requests.getRequestById(id)
      if (!current?.runtimeRevision || current.runtimeState !== 'ready')
        throw new Error('RUNTIME_UNAVAILABLE')
      const runtime = httpRuntimeSchema.parse({
        ...current.runtime,
        version: 2,
        scripts,
      })
      check(
        useHttpStorage().requests.updateRuntime(
          id,
          runtime,
          current.runtimeRevision,
        ),
      )
    }
  }
  if (f.tags && op.space !== 'http')
    tagNames(op.space, id, f.tags)
}
export function snapshotFields(
  op: WorkspaceOperation,
  record: NonNullable<ReturnType<typeof read>>,
): WorkspaceOperation['fields'] {
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(op.fields)) {
    if (key === 'scripts') {
      result[key] = ('runtime' in record
        ? record.runtime?.scripts
        : undefined) ?? {
        preRequest: '',
        postResponse: '',
      }
      continue
    }
    if (key === 'folderOperation') {
      result.folderId
        = op.kind === 'folder'
          ? 'parentId' in record
            ? record.parentId
            : null
          : 'folder' in record
            ? (record.folder?.id ?? null)
            : 'folderId' in record
              ? record.folderId
              : null
      continue
    }
    if (key === 'folderId') {
      result[key]
        = op.kind === 'folder'
          ? 'parentId' in record
            ? record.parentId
            : null
          : 'folder' in record
            ? (record.folder?.id ?? null)
            : 'folderId' in record
              ? record.folderId
              : null
    }
    else if (key === 'tags') {
      result[key] = ('tags' in record ? record.tags : []).map(
        (tag: { name: string }) => tag.name,
      )
    }
    else if (key === 'contentId') {
      result[key] = op.fields.contentId
    }
    else if (
      (key === 'content' || key === 'language')
      && op.space === 'code'
    ) {
      const content = ('contents' in record ? record.contents : []).find(
        (item: { id: number }) => item.id === op.fields.contentId,
      )
      result[key] = content?.[key === 'content' ? 'value' : 'language'] ?? ''
    }
    else {
      result[key] = (record as unknown as Record<string, unknown>)[key] ?? ''
    }
  }
  return result as WorkspaceOperation['fields']
}

export function removeCreated(op: WorkspaceOperation, id: number) {
  if (op.kind === 'folder') {
    const items
      = op.space === 'code'
        ? useStorage().snippets.getSnippets({})
        : op.space === 'notes'
          ? useNotesStorage().notes.getNotes({})
          : useHttpStorage().requests.getRequests({})
    if (
      folders(op.space)
        .getFolders()
        .some(folder => folder.parentId === id)
        || items.some(
          item => ('folderId' in item ? item.folderId : item.folder?.id) === id,
        )
    ) {
      throw new Error('FOLDER_NOT_EMPTY')
    }
    if (!folders(op.space).deleteFolder(id).deleted)
      throw new Error('DELETE_FAILED')
  }
  else if (op.space === 'code') {
    check(
      useStorage().snippets.updateSnippet(id, { isDeleted: 1, folderId: null }),
    )
  }
  else if (op.space === 'notes') {
    check(
      useNotesStorage().notes.updateNote(id, { isDeleted: 1, folderId: null }),
    )
  }
  else {
    check(
      useHttpStorage().requests.updateRequest(id, {
        isDeleted: 1,
        folderId: null,
      }),
    )
  }
}

// A successful storage return is not enough: read back every requested field.
export function verifyWrite(op: WorkspaceOperation, id: number) {
  const record = read({ ...op, id })
  if (!record)
    throw new Error('WRITE_NOT_VERIFIED')
  const actualOp = structuredClone(op)
  if (
    op.space === 'code'
    && op.kind === 'item'
    && op.action === 'create'
    && 'contents' in record
  ) {
    actualOp.fields.contentId = record.contents[0]?.id
  }
  const actual = snapshotFields(actualOp, record)
  const canonical = (value: unknown): string =>
    JSON.stringify(value, (_key, item) =>
      item && typeof item === 'object' && !Array.isArray(item)
        ? Object.fromEntries(
            Object.keys(item)
              .sort()
              .map(key => [key, item[key]]),
          )
        : item)
  for (const [key, expected] of Object.entries(op.fields)) {
    if (key === 'collection') {
      if (
        expected
        && !('collectionConfig' in record && record.collectionConfig)
      ) {
        throw new Error('WRITE_NOT_VERIFIED')
      }
      continue
    }
    const found = actual[key as keyof typeof actual]
    if (key === 'tags') {
      if (
        canonical([...new Set(expected as string[])].sort())
        !== canonical([...(found as string[])].sort())
      ) {
        throw new Error('WRITE_NOT_VERIFIED')
      }
    }
    else if (canonical(found) !== canonical(expected)) {
      throw new Error('WRITE_NOT_VERIFIED')
    }
  }
  return record
}
