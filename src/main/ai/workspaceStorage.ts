import type { WorkspaceOperation } from '../../shared/aiWorkspace'
import { getEntryNameValidationIssue } from '../../shared/entryNameValidation'
import {
  emptyHttpCollection,
  httpCollectionSchema,
} from '../../shared/httpCollection'
import { readGraphqlDraft } from '../../shared/httpGraphql'
import { httpRuntimeSchema } from '../../shared/httpRuntime'
import { useHttpStorage, useNotesStorage, useStorage } from '../storage'

// Stored descriptions can be absent even though public edits accept strings.
// Undo must retain that value rather than turn it into an explicit empty string.
type StorageOperation = Omit<WorkspaceOperation, 'fields'> & {
  fields: Omit<WorkspaceOperation['fields'], 'description'> & {
    description?: string | null
  }
}

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
export function read(op: StorageOperation) {
  if (!op.id)
    return null
  if (op.kind === 'tag' || op.kind === 'environment')
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
          ...(op.space === 'code' ? ['defaultLanguage', 'orderIndex'] : []),
          ...(op.space === 'http' ? ['collection', 'collectionConfig'] : []),
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
                'protocol',
                'formData',
                'runtime',
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
                  ? [
                      'language',
                      'contentId',
                      ...(op.action === 'create' ? ['label'] : []),
                    ]
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
  if (op.space === 'http' && op.kind === 'item') {
    const bodyType
      = f.bodyType
        ?? (before && 'bodyType' in before ? before.bodyType : undefined)
    const body
      = f.body === undefined
        ? before && 'body' in before
          ? before.body
          : null
        : f.body
    if (
      bodyType === 'graphql'
      && (f.body !== undefined || f.bodyType !== undefined)
    ) {
      readGraphqlDraft(body)
    }
    if (
      bodyType === 'form-urlencoded'
      && f.formData !== undefined
      && body !== null
    ) {
      throw new Error('STRUCTURED_FORM_REQUIRES_NULL_BODY')
    }
  }
  if (f.scripts && f.runtime)
    throw new Error('CONFLICTING_RUNTIME')
  if (
    op.space === 'http'
    && op.kind === 'folder'
    && f.collection
    && f.collectionConfig !== undefined
  ) {
    throw new Error('INVALID_OPERATION')
  }
  if (
    op.space === 'http'
    && (f.runtime || f.scripts)
    && before
    && 'runtimeState' in before
    && before.runtimeState !== 'ready'
  ) {
    throw new Error('RUNTIME_UNAVAILABLE')
  }
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
export function write(op: StorageOperation, id: number, restoring = false) {
  const f = op.fields
  if (op.kind === 'folder') {
    const metadata = {
      ...(f.orderIndex !== undefined ? { orderIndex: f.orderIndex } : {}),
      ...(f.name !== undefined ? { name: f.name } : {}),
      ...(f.defaultLanguage !== undefined
        ? { defaultLanguage: f.defaultLanguage }
        : {}),
      ...(f.folderId !== undefined ? { parentId: f.folderId } : {}),
    }
    if (Object.keys(metadata).length)
      check(folders(op.space).updateFolder(id, metadata))
    if (f.collectionConfig !== undefined) {
      const current = useHttpStorage()
        .folders
        .getFolders()
        .find(folder => folder.id === id)
      const base = current?.collectionConfig
        ? httpCollectionSchema.parse(current.collectionConfig)
        : { ...emptyHttpCollection(), auth: { type: 'inherit' as const } }
      const config
        = f.collectionConfig === null
          ? null
          : restoring
            ? httpCollectionSchema.parse(f.collectionConfig)
            : httpCollectionSchema.parse({
                ...base,
                ...f.collectionConfig,
                ...(f.collectionConfig.postResponseOrder === null
                  ? { postResponseOrder: undefined }
                  : {}),
                ...(f.collectionConfig.runtime
                  ? {
                      runtime: mergeRuntime(
                        base.runtime,
                        f.collectionConfig.runtime,
                      ),
                    }
                  : {}),
              })
      check(
        useHttpStorage().folders.updateFolder(id, { collectionConfig: config }),
      )
    }
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
    if (
      f.content !== undefined
      || f.language !== undefined
      || f.label !== undefined
    ) {
      const contentId
        = f.contentId ?? storage.getSnippetById(id)?.contents[0]?.id
      if (contentId) {
        check(
          storage.updateSnippetContent(id, contentId, {
            ...(f.content !== undefined ? { value: f.content } : {}),
            ...(f.language !== undefined ? { language: f.language } : {}),
            ...(f.label !== undefined ? { label: f.label } : {}),
          }),
        )
      }
      else {
        storage.createSnippetContent(id, {
          label: f.label ?? 'Fragment',
          language: f.language ?? 'plain_text',
          value: f.content ?? '',
        })
      }
    }
  }
  else if (op.space === 'notes') {
    if (Object.keys(metadata).length)
      check(useNotesStorage().notes.updateNote(id, metadata))
    if (
      f.properties
      && (op.action !== 'create' || Object.keys(f.properties).length > 0)
    ) {
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
      runtime: runtimePatch,
      collectionConfig: _collectionConfig,
      variables: _variables,
      unset: _unset,
      environmentId: _environmentId,
      activate: _activate,
      label: _label,
      ...fields
    } = f
    if (Object.keys(fields).length) {
      const { description, ...requestFields } = fields
      // HTTP storage requires a string; nullable descriptions belong to Code/Notes.
      if (description === null)
        throw new Error('INVALID_OPERATION')
      check(
        useHttpStorage().requests.updateRequest(id, {
          ...requestFields,
          ...(description !== undefined ? { description } : {}),
        }),
      )
    }
    if (scripts || runtimePatch) {
      const current = useHttpStorage().requests.getRequestById(id)
      if (!current?.runtimeRevision || current.runtimeState !== 'ready')
        throw new Error('RUNTIME_UNAVAILABLE')
      const runtime
        = restoring && runtimePatch
          ? httpRuntimeSchema.parse(runtimePatch)
          : mergeRuntime(current.runtime!, runtimePatch ?? { scripts })
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
function projectPatch(value: unknown, patch: unknown): unknown {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch))
    return value
  const record
    = value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {}
  return Object.fromEntries(
    Object.entries(patch).map(([key, child]) => [
      key,
      key === 'unsetTransport' && Array.isArray(child)
        ? child.filter(
            name =>
              (record.transport as Record<string, unknown> | undefined)?.[
                name
              ] === undefined,
          )
        : key === 'postResponseOrder' && child === null
          ? (record[key] ?? null)
          : projectPatch(record[key], child),
    ]),
  )
}
function mergeRuntime(
  current: import('../../shared/httpRuntime').HttpRuntime,
  patch: NonNullable<WorkspaceOperation['fields']['runtime']>,
) {
  const { unsetTransport, ...fields } = patch
  if (unsetTransport?.some(key => patch.transport?.[key] !== undefined))
    throw new Error('CONFLICTING_RUNTIME')
  const transport = { ...current.transport, ...patch.transport }
  for (const key of unsetTransport ?? []) delete transport[key]
  return httpRuntimeSchema.parse({
    ...current,
    ...fields,
    version: patch.version ?? (patch.scripts ? 2 : current.version),
    ...(patch.transport || unsetTransport ? { transport } : {}),
  })
}
export function snapshotFields(
  op: StorageOperation,
  record: NonNullable<ReturnType<typeof read>>,
  restoring = false,
): StorageOperation['fields'] {
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(op.fields)) {
    if (key === 'runtime' || key === 'collectionConfig') {
      const value
        = key === 'runtime'
          ? 'runtime' in record
            ? record.runtime
            : undefined
          : 'collectionConfig' in record
            ? record.collectionConfig
            : undefined
      result[key]
        = value == null
          ? null
          : restoring
            ? structuredClone(value)
            : projectPatch(value, op.fields[key])
      continue
    }
    if (key === 'scripts') {
      if (restoring && 'runtime' in record && record.runtime) {
        result.runtime = structuredClone(record.runtime)
        continue
      }
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
    else if (key === 'description') {
      result[key] = 'description' in record ? record.description : null
    }
    else if (key === 'body' && op.space === 'http') {
      result[key] = 'body' in record ? record.body : null
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
      (key === 'content' || key === 'language' || key === 'label')
      && op.space === 'code'
    ) {
      const content = ('contents' in record ? record.contents : []).find(
        (item: { id: number }) => item.id === op.fields.contentId,
      )
      result[key] = content?.[key === 'content' ? 'value' : key] ?? ''
    }
    else {
      result[key] = (record as unknown as Record<string, unknown>)[key] ?? ''
    }
  }
  return result as StorageOperation['fields']
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
export function verifyWrite(op: StorageOperation, id: number) {
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

export function validateFileReferences(
  op: WorkspaceOperation,
  messages: string[],
  existingReferences: ReadonlySet<string> = new Set(),
) {
  if (
    op.space !== 'http'
    || op.kind !== 'item'
    || !['create', 'update'].includes(op.action)
  ) {
    return
  }
  const before = op.id ? useHttpStorage().requests.getRequestById(op.id) : null
  const existing = new Set([
    ...existingReferences,
    ...(before?.formData ?? [])
      .filter(entry => entry.type === 'file')
      .map(entry => entry.value),
    ...(before?.bodyType === 'binary' && before.body ? [before.body] : []),
  ])
  const paths = [
    ...(op.fields.formData ?? [])
      .filter(entry => entry.type === 'file')
      .map(entry => entry.value),
    ...((op.fields.bodyType ?? before?.bodyType) === 'binary'
      && (op.fields.body ?? before?.body)
      ? [op.fields.body === undefined ? before!.body! : op.fields.body!]
      : []),
  ]
  for (const path of paths) {
    if (
      path
      && !existing.has(path)
      && !messages.some(message => message.includes(path))
    ) {
      throw new Error('FILE_REFERENCE_NOT_REQUESTED')
    }
  }
}
