import type { WorkspaceOperation } from '../../shared/aiWorkspace'
import { redactAiHttp } from '../../shared/aiHttp'
import { getEntryNameValidationIssue } from '../../shared/entryNameValidation'
import { useHttpStorage, useNotesStorage, useStorage } from '../storage'
import { PartialCreateError } from '../storage/partialCreateError'
import {
  applyEnvironment,
  environmentPreview,
  environmentSnapshot,
  validateEnvironment,
} from './workspaceEnvironments'

export function isLifecycle(op: WorkspaceOperation) {
  return (
    op.kind === 'environment'
    || op.kind === 'fragment'
    || op.kind === 'tag'
    || !['create', 'update'].includes(op.action)
  )
}
function storage(space: WorkspaceOperation['space']) {
  return space === 'code'
    ? useStorage()
    : space === 'notes'
      ? useNotesStorage()
      : useHttpStorage()
}
function item(op: WorkspaceOperation, id = op.id!) {
  return op.space === 'code'
    ? useStorage().snippets.getSnippetById(id)
    : op.space === 'notes'
      ? useNotesStorage().notes.getNoteById(id)
      : useHttpStorage().requests.getRequestById(id)
}
function items(op: WorkspaceOperation) {
  return op.space === 'code'
    ? [
        ...useStorage().snippets.getSnippets({ isDeleted: 0 }),
        ...useStorage().snippets.getSnippets({ isDeleted: 1 }),
      ]
    : op.space === 'http'
      ? [
          ...useHttpStorage().requests.getRequests({ isDeleted: 0 }),
          ...useHttpStorage().requests.getRequests({ isDeleted: 1 }),
        ]
      : [
          ...useNotesStorage().notes.getNotes({ isDeleted: 0 }),
          ...useNotesStorage().notes.getNotes({ isDeleted: 1 }),
        ]
}
function folderId(record: {
  folderId?: number | null
  folder?: { id: number } | null
}) {
  return 'folderId' in record
    ? (record.folderId ?? null)
    : (record.folder?.id ?? null)
}
export function lifecycleSnapshot(op: WorkspaceOperation) {
  if (op.kind === 'environment')
    return environmentSnapshot(op)
  const db = storage(op.space)
  if (op.kind === 'tag') {
    if (op.space === 'http')
      throw new Error('INVALID_OPERATION')
    const tag = (op.space === 'code' ? useStorage() : useNotesStorage()).tags.getTags().find(tag => tag.id === op.id)
    return {
      name: tag?.name ?? op.fields.name ?? '',
      tag,
      ...(op.action === 'create'
        ? {
            existingNames: (op.space === 'notes'
              ? useNotesStorage()
              : useStorage()
            ).tags.getTags(),
          }
        : {}),
      affectedItems: items(op)
        .filter(
          record =>
            'tags' in record && record.tags.some(tag => tag.id === op.id),
        )
        .map(record => item(op, record.id)),
    }
  }
  if (op.kind === 'folder') {
    const all = db.folders.getFolders()
    const ids = new Set([op.id!])
    for (let size = 0; size !== ids.size;) {
      size = ids.size
      for (const folder of all) {
        if (folder.parentId != null && ids.has(folder.parentId))
          ids.add(folder.id)
      }
    }
    return {
      name: all.find(folder => folder.id === op.id)?.name ?? '',
      folders: all.filter(folder => ids.has(folder.id)),
      affectedItems: items(op)
        .filter(
          record => folderId(record) !== null && ids.has(folderId(record)!),
        )
        .map(record => item(op, record.id)),
    }
  }
  const record = item(op)
  return { name: record?.name ?? '', record }
}
export function validateLifecycle(op: WorkspaceOperation) {
  if (op.kind === 'environment')
    return validateEnvironment(op)
  if (op.kind === 'tag' && ['create', 'update'].includes(op.action)) {
    if (
      op.space !== 'notes'
      || !op.fields.name?.trim()
      || getEntryNameValidationIssue(op.fields.name)
      || Object.keys(op.fields).some(key => key !== 'name')
      || (op.action === 'create' ? op.id !== undefined : !op.id)
    ) {
      throw new Error('INVALID_OPERATION')
    }
    const tags = useNotesStorage().tags.getTags()
    if (tags.some(tag => tag.name === op.fields.name && tag.id !== op.id))
      throw new Error('NAME_CONFLICT')
    if (op.action === 'update' && !tags.some(tag => tag.id === op.id))
      throw new Error('TARGET_UNAVAILABLE')
    return lifecycleSnapshot(op)
  }
  if (!op.id)
    throw new Error('INVALID_TARGET')
  const snapshot = lifecycleSnapshot(op)
  const allowed
    = op.kind === 'fragment'
      ? ['contentId', 'label', 'content', 'language']
      : op.action === 'duplicate'
        ? ['name', 'folderId']
        : []
  if (Object.keys(op.fields).some(key => !allowed.includes(key)))
    throw new Error('INVALID_OPERATION')
  if (op.kind === 'folder' || op.kind === 'tag') {
    if (op.action !== 'delete' || !snapshot.name)
      throw new Error('TARGET_UNAVAILABLE')
    if (
      'affectedItems' in snapshot
      && snapshot.affectedItems?.some(
        record => !record || record.pendingCloudDownload,
      )
    ) {
      throw new Error('TARGET_UNAVAILABLE')
    }
    return snapshot
  }
  const record = 'record' in snapshot ? snapshot.record : undefined
  if (
    !record
    || record.pendingCloudDownload
    || (op.action === 'duplicate'
      && 'runtimeState' in record
      && record.runtimeState !== 'ready')
  ) {
    throw new Error('TARGET_UNAVAILABLE')
  }
  if (op.kind === 'fragment') {
    if (op.space !== 'code' || !('contents' in record) || record.isDeleted)
      throw new Error('TARGET_UNAVAILABLE')
    const fragment = record.contents.find(
      content => content.id === op.fields.contentId,
    )
    if (op.action === 'create') {
      if (
        !op.fields.label
        || op.fields.content === undefined
        || !op.fields.language
        || op.fields.contentId !== undefined
      ) {
        throw new Error('INVALID_OPERATION')
      }
    }
    else if (!fragment || !['update', 'delete'].includes(op.action)) {
      throw new Error('TARGET_UNAVAILABLE')
    }
    if (op.action === 'update' && Object.keys(op.fields).length < 2)
      throw new Error('INVALID_OPERATION')
    if (
      op.action === 'delete'
      && (record.contents.length <= 1 || Object.keys(op.fields).length !== 1)
    ) {
      throw new Error('LAST_FRAGMENT')
    }
  }
  else if (
    op.kind !== 'item'
    || !['duplicate', 'trash', 'restore', 'permanentDelete'].includes(op.action)
  ) {
    throw new Error('INVALID_OPERATION')
  }
  else if (
    ['restore', 'permanentDelete'].includes(op.action)
      ? !record.isDeleted
      : record.isDeleted
  ) {
    throw new Error('TARGET_UNAVAILABLE')
  }
  if (op.fields.name && getEntryNameValidationIssue(op.fields.name))
    throw new Error('INVALID_NAME')
  if (
    op.fields.folderId != null
    && !storage(op.space)
      .folders
      .getFolders()
      .some(folder => folder.id === op.fields.folderId)
  ) {
    throw new Error('FOLDER_NOT_FOUND')
  }
  return snapshot
}
export function lifecyclePreview(op: WorkspaceOperation) {
  if (op.kind === 'environment')
    return environmentPreview(op)
  const before = validateLifecycle(op)
  if (op.kind === 'fragment') {
    const record = 'record' in before ? before.record : undefined
    const fragment
      = record && 'contents' in record
        ? record.contents.find(content => content.id === op.fields.contentId)
        : undefined
    const current = {
      content: fragment?.value ?? '',
      label: fragment?.label ?? '',
      language: fragment?.language ?? '',
    }
    const keys = (['content', 'label', 'language'] as const).filter(
      key => op.action === 'delete' || key in op.fields,
    )
    return {
      name: before.name,
      before:
        op.action === 'create'
          ? {}
          : Object.fromEntries(keys.map(key => [key, current[key]])),
      after:
        op.action === 'delete'
          ? {}
          : Object.fromEntries(keys.map(key => [key, op.fields[key]])),
      irreversible: op.action === 'delete',
    }
  }
  return {
    before:
      op.space === 'http'
        ? { ...before, ...(redactAiHttp(before) as typeof before) }
        : before,
    after: { action: op.action, ...op.fields },
    irreversible: op.action === 'delete' || op.action === 'permanentDelete',
  }
}
function check(result: unknown) {
  if (
    result
    && typeof result === 'object'
    && (('notFound' in result && result.notFound)
      || ('invalidInput' in result && result.invalidInput)
      || ('deleted' in result && !result.deleted))
  ) {
    throw new Error('WRITE_NOT_VERIFIED')
  }
}
function updateItem(
  op: WorkspaceOperation,
  id: number,
  fields: { isDeleted: number, folderId: number | null, name?: string },
) {
  check(
    op.space === 'code'
      ? useStorage().snippets.updateSnippet(id, fields)
      : op.space === 'notes'
        ? useNotesStorage().notes.updateNote(id, fields)
        : useHttpStorage().requests.updateRequest(id, fields),
  )
  const saved = item(op, id)
  if (
    !saved
    || saved.isDeleted !== fields.isDeleted
    || folderId(saved) !== fields.folderId
    || (fields.name !== undefined && saved.name !== fields.name)
  ) {
    throw new Error('WRITE_NOT_VERIFIED')
  }
}

// Uses the same storage mutations as the UI. Only operations with an exact
// inverse retain an Undo action; deleted fragment/folder/tag IDs cannot be restored.
export function applyLifecycle(op: WorkspaceOperation) {
  if (op.kind === 'environment')
    return applyEnvironment(op)
  const snapshot = validateLifecycle(op)
  const db = storage(op.space)
  if (op.kind === 'tag' && ['create', 'update'].includes(op.action)) {
    const tags = useNotesStorage().tags
    const before = tags.getTags().find(tag => tag.id === op.id)
    const id
      = op.action === 'create' ? tags.createTag(op.fields.name!).id : op.id!
    if (op.action === 'update')
      check(tags.updateTag(id, op.fields.name!))
    const read = () => ({
      tag: tags.getTags().find(tag => tag.id === id),
      relatedIds: items(op)
        .filter(
          record =>
            'tags' in record && record.tags.some(tag => tag.id === id),
        )
        .map(record => record.id)
        .sort((a, b) => a - b),
    })
    if (read().tag?.name !== op.fields.name)
      throw new Error('WRITE_NOT_VERIFIED')
    return {
      id,
      name: op.fields.name!,
      read,
      restore: () => {
        if (before) {
          if (
            tags
              .getTags()
              .some(tag => tag.name === before.name && tag.id !== id)
          ) {
            throw new Error('UNDO_STALE')
          }
          check(tags.updateTag(id, before.name))
          if (read().tag?.name !== before.name)
            throw new Error('WRITE_NOT_VERIFIED')
        }
        else {
          if (read().relatedIds.length)
            throw new Error('UNDO_STALE')
          check(tags.deleteTag(id))
          if (read().tag)
            throw new Error('WRITE_NOT_VERIFIED')
        }
      },
    }
  }
  if (op.kind === 'folder' || op.kind === 'tag') {
    if (op.kind === 'folder') {
      check(db.folders.deleteFolder(op.id!))
      if (
        'folders' in snapshot
        && snapshot.folders?.some(folder =>
          db.folders.getFolders().some(saved => saved.id === folder.id),
        )
      ) {
        throw new Error('WRITE_NOT_VERIFIED')
      }
      if (
        'affectedItems' in snapshot
        && snapshot.affectedItems?.some(
          record =>
            record
            && (!item(op, record.id)?.isDeleted
              || (item(op, record.id) && folderId(item(op, record.id)!) !== null)),
        )
      ) {
        throw new Error('WRITE_NOT_VERIFIED')
      }
    }
    else {
      if (op.space === 'http')
        throw new Error('INVALID_OPERATION')
      const tags = (op.space === 'code' ? useStorage() : useNotesStorage())
        .tags
      check(tags.deleteTag(op.id!))
      if (
        tags.getTags().some(tag => tag.id === op.id)
        || items(op).some(
          record =>
            'tags' in record && record.tags.some(tag => tag.id === op.id),
        )
      ) {
        throw new Error('WRITE_NOT_VERIFIED')
      }
    }
    return {
      id: op.id!,
      name: snapshot.name,
      read: () => lifecycleSnapshot(op),
    }
  }
  const before = structuredClone(item(op)!)
  if (op.kind === 'fragment' && 'contents' in before) {
    const snippets = useStorage().snippets
    let contentId = op.fields.contentId
    const fields = {
      ...(op.fields.label === undefined ? {} : { label: op.fields.label }),
      ...(op.fields.content === undefined ? {} : { value: op.fields.content }),
      ...(op.fields.language === undefined
        ? {}
        : { language: op.fields.language }),
    }
    const restore
      = op.action === 'delete'
        ? undefined
        : () => {
            if (op.action === 'create') {
              check(snippets.deleteSnippetContent(op.id!, contentId!))
            }
            else {
              const original = before.contents.find(
                content => content.id === contentId,
              )!
              check(
                snippets.updateSnippetContent(
                  op.id!,
                  contentId!,
                  Object.fromEntries(
                    Object.keys(fields).map(key => [
                      key,
                      original[key as keyof typeof original],
                    ]),
                  ),
                ),
              )
            }
            const restored = snippets
              .getSnippetById(op.id!)
              ?.contents
              .find(content => content.id === contentId)
            const original = before.contents.find(
              content => content.id === contentId,
            )
            if (
              op.action === 'create'
                ? Boolean(restored)
                : !restored
                  || !original
                  || Object.keys(fields).some(
                    key =>
                      restored[key as keyof typeof restored]
                      !== original[key as keyof typeof original],
                  )
            ) {
              throw new Error('WRITE_NOT_VERIFIED')
            }
          }
    let saved: NonNullable<ReturnType<typeof snippets.getSnippetById>>
    try {
      if (op.action === 'create') {
        contentId = snippets.createSnippetContent(op.id!, {
          label: op.fields.label!,
          value: op.fields.content!,
          language: op.fields.language!,
        }).id
      }
      else if (op.action === 'delete') {
        check(snippets.deleteSnippetContent(op.id!, contentId!))
      }
      else {
        check(snippets.updateSnippetContent(op.id!, contentId!, fields))
      }
      saved = snippets.getSnippetById(op.id!)!
      const fragment = saved.contents.find(
        content => content.id === contentId,
      )
      if (
        op.action === 'delete'
          ? !!fragment
          : !fragment
            || Object.entries(fields).some(
              ([key, value]) =>
                fragment[key as keyof typeof fragment] !== value,
            )
      ) {
        throw new Error('WRITE_NOT_VERIFIED')
      }
    }
    catch (error) {
      if (op.action === 'create') {
        // Storage can persist the fragment and then throw before returning its ID.
        // The call is synchronous: only newly added matching fragments belong to it.
        const previousIds = new Set(
          before.contents.map(content => content.id),
        )
        const added
          = snippets
            .getSnippetById(op.id!)
            ?.contents
            .filter(
              content =>
                !previousIds.has(content.id)
                && Object.entries(fields).every(
                  ([key, value]) =>
                    content[key as keyof typeof content] === value,
                ),
            ) ?? []
        for (const content of added) {
          check(snippets.deleteSnippetContent(op.id!, content.id))
          if (
            snippets
              .getSnippetById(op.id!)
              ?.contents
              .some(saved => saved.id === content.id)
          ) {
            throw new Error('WRITE_NOT_VERIFIED')
          }
        }
      }
      else {
        restore?.()
      }
      throw error
    }
    return {
      id: op.id!,
      name: saved.name,
      read: () => {
        const current = snippets.getSnippetById(op.id!)
        return current
          ? {
              id: current.id,
              createdAt: current.createdAt,
              isDeleted: current.isDeleted,
              pendingCloudDownload: Boolean(current.pendingCloudDownload),
              fragment: (() => {
                const fragment = current.contents.find(
                  content => content.id === contentId,
                )
                return fragment && op.action === 'update'
                  ? {
                      id: fragment.id,
                      ...Object.fromEntries(
                        Object.keys(fields).map(key => [
                          key,
                          fragment[key as keyof typeof fragment],
                        ]),
                      ),
                    }
                  : fragment
              })(),
              canRemove:
                op.action === 'create'
                  ? before.contents.length === 0 || current.contents.length > 1
                  : undefined,
            }
          : null
      },
      restore,
    }
  }

  if (op.action === 'permanentDelete') {
    check(
      op.space === 'code'
        ? useStorage().snippets.deleteSnippet(op.id!)
        : op.space === 'notes'
          ? useNotesStorage().notes.deleteNote(op.id!)
          : useHttpStorage().requests.deleteRequest(op.id!),
    )
    if (item(op))
      throw new Error('WRITE_NOT_VERIFIED')
    return { id: op.id!, name: before.name, read: () => item(op) }
  }
  if (op.action === 'trash' || op.action === 'restore') {
    updateItem(op, op.id!, {
      isDeleted: op.action === 'trash' ? 1 : 0,
      folderId: null,
    })
    return {
      id: op.id!,
      name: item(op)!.name,
      read: () => item(op),
      restore: () =>
        updateItem(op, op.id!, {
          isDeleted: before.isDeleted,
          folderId: folderId(before),
          name: before.name,
        }),
    }
  }
  if (op.action !== 'duplicate')
    throw new Error('INVALID_OPERATION')
  let name = op.fields.name ?? `${before.name} - copy`
  const destination
    = op.fields.folderId === undefined ? folderId(before) : op.fields.folderId
  if (!op.fields.name && op.space !== 'code') {
    const names = items(op)
      .filter(record => !record.isDeleted && folderId(record) === destination)
      .map(record => record.name.toLowerCase())
    const base = name
    if (names.includes(name.toLowerCase())) {
      const indexes = names
        .filter(name => name.startsWith(`${base.toLowerCase()} `))
        .map(name => Number(name.slice(base.length + 1)))
        .filter(Number.isFinite)
      name = `${base} ${Math.max(0, ...indexes) + 1}`
    }
  }
  let id: number | undefined
  try {
    id
      = op.space === 'code'
        ? useStorage().snippets.createSnippet({ name, folderId: destination }).id
        : op.space === 'http'
          ? useHttpStorage().requests.createRequest({
            name,
            folderId: destination,
          }).id
          : useNotesStorage().notes.createNote({
            name,
            folderId: destination,
            ...('properties' in before
              ? { properties: before.properties }
              : {}),
          }).id
    if (op.space === 'http' && 'method' in before) {
      const {
        protocol,
        method,
        url,
        headers,
        query,
        bodyType,
        body,
        formData,
        auth,
        description,
      } = before
      check(
        useHttpStorage().requests.updateRequest(id, {
          protocol,
          method,
          url,
          headers,
          query,
          bodyType,
          body,
          formData,
          auth,
          description,
        }),
      )
      if (before.runtime) {
        check(
          useHttpStorage().requests.updateRuntime(
            id,
            before.runtime,
            'missing',
          ),
        )
      }
    }
    else if (op.space === 'code' && 'contents' in before) {
      for (const fragment of before.contents) {
        useStorage().snippets.createSnippetContent(id, {
          label: fragment.label,
          value: fragment.value,
          language: fragment.language,
        })
      }
      for (const tag of before.tags)
        check(useStorage().snippets.addTagToSnippet(id, tag.id))
    }
    else if ('content' in before) {
      check(
        useNotesStorage().notes.updateNote(id, {
          description: before.description,
        }),
      )
      check(useNotesStorage().notes.updateNoteContent(id, before.content))
      for (const tag of before.tags)
        check(useNotesStorage().notes.addTagToNote(id, tag.id))
    }
    const saved = item(op, id)!
    const values = (record: typeof before) =>
      'contents' in record
        ? record.contents.map(({ label, value, language }) => ({
            label,
            value,
            language,
          }))
        : 'method' in record
          ? (({
              protocol,
              method,
              url,
              headers,
              query,
              bodyType,
              body,
              formData,
              auth,
              description,
              runtime,
            }) => ({
              protocol,
              method,
              url,
              headers,
              query,
              bodyType,
              body,
              formData,
              auth,
              description,
              runtime,
            }))(record)
          : {
              content: record.content,
              properties: record.properties,
              description: record.description,
            }
    if (
      !saved
      || saved.name !== name
      || folderId(saved) !== destination
      || JSON.stringify(values(saved)) !== JSON.stringify(values(before))
      || ('tags' in saved ? saved.tags : [])
        .map(tag => tag.id)
        .sort()
        .join()
        !== ('tags' in before ? before.tags : [])
          .map(tag => tag.id)
          .sort()
          .join()
    ) {
      throw new Error('WRITE_NOT_VERIFIED')
    }
    return {
      id,
      name: saved.name,
      read: () => item(op, id!),
      restore: () => updateItem(op, id!, { isDeleted: 1, folderId: null }),
    }
  }
  catch (error) {
    if (error instanceof PartialCreateError)
      id = error.itemId
    if (id !== undefined) {
      check(
        op.space === 'code'
          ? useStorage().snippets.deleteSnippet(id)
          : op.space === 'notes'
            ? useNotesStorage().notes.deleteNote(id)
            : useHttpStorage().requests.deleteRequest(id),
      )
      if (item(op, id))
        throw new Error('WRITE_NOT_VERIFIED')
    }
    throw error
  }
}
