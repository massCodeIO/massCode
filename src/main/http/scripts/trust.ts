import type { HttpScripts } from '../../../shared/httpScripts'
import { createHash } from 'node:crypto'
import Store from 'electron-store'
import { readHttpCollection } from '../../../shared/httpCollection'
import { emptyHttpScripts, hasHttpScripts } from '../../../shared/httpScripts'
import { useHttpStorage } from '../../storage'
import { getVaultPath } from '../../storage/providers/markdown/runtime/paths'

interface Grant {
  code: string
  baseline: string
}
// No renderer store bridge, vault persistence, or export path for grants.
let localStore: Store<{ grants: Record<string, Grant> }> | undefined
function getStore() {
  return (localStore ??= new Store<{ grants: Record<string, Grant> }>({
    name: 'http-script-trust',
    defaults: { grants: {} },
  }))
}
function digest(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}
function identity(
  requestId: number,
  subject: 'request' | 'collection' = 'request',
) {
  if (subject === 'collection') {
    const folder = useHttpStorage()
      .folders
      .getFolders()
      .find(folder => folder.id === requestId)
    if (!folder || folder.parentId !== null)
      throw new Error('HTTP_COLLECTION_INVALID')
    const config = readHttpCollection(folder)
    return {
      key: digest([getVaultPath(), 'collection', folder.id, folder.createdAt]),
      baseline: digest(config?.runtime.scripts ?? emptyHttpScripts()),
    }
  }
  const record = useHttpStorage().requests.getRequestById(requestId)
  if (
    !record
    || record.isDeleted
    || record.protocol === 'websocket'
    || record.runtimeState !== 'ready'
  ) {
    throw new Error('HTTP_RUNTIME_UNAVAILABLE')
  }
  return {
    key: digest([getVaultPath(), record.id, record.createdAt]),
    baseline: digest(record.runtime?.scripts ?? emptyHttpScripts()),
  }
}
export function scriptsTrusted(
  requestId: number | null,
  scripts?: HttpScripts,
  subject: 'request' | 'collection' = 'request',
): boolean {
  if (requestId === null)
    return !hasHttpScripts(scripts)
  const { key, baseline } = identity(requestId, subject)
  const trust = getStore()
  const grants = trust.get('grants')
  const grant = grants[key]
  if (
    grant?.code === digest(scripts)
    && (grant.baseline === baseline || grant.code === baseline)
  ) {
    if (grant.baseline !== baseline) {
      grants[key] = { ...grant, baseline }
      trust.set('grants', grants)
    }
    return true
  }
  if (grant) {
    delete grants[key]
    trust.set('grants', grants)
  }
  return !hasHttpScripts(scripts)
}
export function setScriptTrust(
  requestId: number,
  scripts: HttpScripts,
  allowed: boolean,
  subject: 'request' | 'collection' = 'request',
) {
  const { key, baseline } = identity(requestId, subject)
  const trust = getStore()
  const grants = trust.get('grants')
  delete grants[key]
  if (allowed && hasHttpScripts(scripts))
    grants[key] = { code: digest(scripts), baseline }
  trust.set('grants', grants)
}
