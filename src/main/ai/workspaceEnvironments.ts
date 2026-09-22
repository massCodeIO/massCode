import type { WorkspaceOperation } from '../../shared/aiWorkspace'
import { redactAiHttp } from '../../shared/aiHttp'
import { getEntryNameValidationIssue } from '../../shared/entryNameValidation'
import { deleteEnvironmentSecrets, getUsableSecretKeys } from '../http/secrets'
import { useHttpStorage } from '../storage'

function db() {
  return useHttpStorage().environments
}
function find(id?: number) {
  return db()
    .getEnvironments()
    .find(item => item.id === id)
}
export function readEnvironmentState(id?: number) {
  const records
    = id === undefined
      ? db().getEnvironments()
      : [find(id)].filter(item => item !== undefined)
  if (id !== undefined && !records.length)
    throw new Error('TARGET_UNAVAILABLE')
  return {
    activeEnvironmentId: db().getActiveEnvironmentId(),
    items: records.map((env) => {
      const protectedKeys = env.secretKeys ?? []
      const usable = new Set(
        getUsableSecretKeys(env.secretStorageId ?? String(env.id)),
      )
      return {
        id: env.id,
        name: env.name,
        variables: redactAiHttp(
          Object.fromEntries(
            Object.entries(env.variables).filter(
              ([key]) => !protectedKeys.includes(key),
            ),
          ),
        ),
        protectedKeys,
        missingProtectedKeys: protectedKeys.filter(key => !usable.has(key)),
      }
    }),
  }
}
export function environmentSnapshot(op: WorkspaceOperation) {
  const environment = find(
    op.action === 'activate' ? (op.fields.environmentId ?? undefined) : op.id,
  )
  return {
    name: environment?.name ?? op.fields.name ?? '',
    environment: environment ?? null,
    activeEnvironmentId: db().getActiveEnvironmentId(),
  }
}
export function validateEnvironment(op: WorkspaceOperation) {
  const allowed
    = op.action === 'create'
      ? ['name', 'variables', 'activate']
      : op.action === 'update'
        ? ['name', 'variables', 'unset']
        : op.action === 'activate'
          ? ['environmentId']
          : []
  if (
    op.space !== 'http'
    || !['create', 'update', 'delete', 'activate'].includes(op.action)
    || Object.keys(op.fields).some(key => !allowed.includes(key))
    || JSON.stringify(op.fields).includes('[REDACTED]')
  ) {
    throw new Error('INVALID_OPERATION')
  }
  const snapshot = environmentSnapshot(op)
  if (
    (op.action === 'create' && (!op.fields.name || op.id !== undefined))
    || (['update', 'delete'].includes(op.action) && !snapshot.environment)
    || (op.action === 'activate'
      && (op.fields.environmentId === undefined
        || (op.fields.environmentId !== null && !snapshot.environment)))
  ) {
    throw new Error('TARGET_UNAVAILABLE')
  }
  if (op.fields.name && getEntryNameValidationIssue(op.fields.name))
    throw new Error('INVALID_NAME')
  if (op.action === 'update' && !Object.keys(op.fields).length)
    throw new Error('INVALID_OPERATION')
  const protectedKeys = new Set(snapshot.environment?.secretKeys ?? [])
  for (const key of [
    ...Object.keys(op.fields.variables ?? {}),
    ...(op.fields.unset ?? []),
  ]) {
    if (protectedKeys.has(key))
      throw new Error('PROTECTED_VARIABLE')
  }
  for (const [key, value] of Object.entries(op.fields.variables ?? {})) {
    if (
      JSON.stringify(redactAiHttp({ [key]: value }))
      !== JSON.stringify({ [key]: value })
    ) {
      throw new Error('PROTECTED_VARIABLE')
    }
  }
  return snapshot
}
export function environmentPreview(op: WorkspaceOperation) {
  const snapshot = validateEnvironment(op)
  return {
    before: {
      name: snapshot.name,
      activeEnvironmentId: snapshot.activeEnvironmentId,
      environment: snapshot.environment
        ? readEnvironmentState(snapshot.environment.id).items[0]
        : null,
    },
    after: { action: op.action, ...op.fields },
    irreversible: op.action === 'delete',
  }
}
function check(result: {
  notFound?: boolean
  invalidInput?: boolean
  deleted?: boolean
}) {
  if (result.notFound || result.invalidInput || result.deleted === false)
    throw new Error('WRITE_NOT_VERIFIED')
}
function remove(id: number) {
  const result = db().deleteEnvironment(id)
  check(result)
  // Matches UI deletion: persisted environment is removed even if OS-keychain cleanup fails.
  try {
    deleteEnvironmentSecrets(result.secretScopeId!)
  }
  catch {
    console.warn('[masscode:ai] Environment secret cleanup failed')
  }
  if (find(id))
    throw new Error('WRITE_NOT_VERIFIED')
}
function update(id: number, name: string, variables: Record<string, string>) {
  check(db().updateEnvironment(id, { name, variables }))
  const saved = find(id)
  if (
    !saved
    || saved.name !== name
    || Object.keys(saved.variables).length !== Object.keys(variables).length
    || Object.entries(variables).some(
      ([key, value]) => saved.variables[key] !== value,
    )
  ) {
    throw new Error('WRITE_NOT_VERIFIED')
  }
}
export function applyEnvironment(op: WorkspaceOperation) {
  const before = structuredClone(validateEnvironment(op))
  if (op.action === 'activate') {
    const set = (id: number | null) => {
      check(db().setActiveEnvironment(id))
      if (db().getActiveEnvironmentId() !== id)
        throw new Error('WRITE_NOT_VERIFIED')
    }
    set(op.fields.environmentId!)
    return {
      id: op.fields.environmentId ?? 0,
      name: before.name,
      read: () => environmentSnapshot(op),
      restore: () => set(before.activeEnvironmentId),
    }
  }
  if (op.action === 'delete') {
    remove(op.id!)
    return {
      id: op.id!,
      name: before.name,
      read: () => environmentSnapshot(op),
    }
  }
  if (op.action === 'create') {
    const id = db().createEnvironment({
      name: op.fields.name!,
      variables: op.fields.variables,
    }).id
    try {
      update(id, op.fields.name!, op.fields.variables ?? {})
      if (op.fields.activate) {
        check(db().setActiveEnvironment(id))
        if (db().getActiveEnvironmentId() !== id)
          throw new Error('WRITE_NOT_VERIFIED')
      }
    }
    catch (error) {
      remove(id)
      throw error
    }
    return {
      id,
      name: find(id)!.name,
      read: () => environmentSnapshot({ ...op, id }),
      restore: () => {
        if (
          before.activeEnvironmentId !== null
          && !find(before.activeEnvironmentId)
        ) {
          throw new Error('STALE_PROPOSAL')
        }
        remove(id)
        if (op.fields.activate) {
          check(db().setActiveEnvironment(before.activeEnvironmentId))
          if (db().getActiveEnvironmentId() !== before.activeEnvironmentId)
            throw new Error('WRITE_NOT_VERIFIED')
        }
      },
    }
  }
  const original = before.environment!
  const variables = { ...original.variables, ...op.fields.variables }
  for (const key of op.fields.unset ?? []) delete variables[key]
  try {
    update(op.id!, op.fields.name ?? original.name, variables)
  }
  catch (error) {
    update(op.id!, original.name, original.variables)
    throw error
  }
  return {
    id: op.id!,
    name: find(op.id!)!.name,
    read: () => environmentSnapshot(op),
    restore: () => update(op.id!, original.name, original.variables),
  }
}
