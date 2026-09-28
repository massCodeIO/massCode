import type { VariableLayer } from './variableInspection'
import { i18n } from '@/electron'
import {
  applyHttpCollection,
  httpFolderChain,
  resolveHttpFolderConfig,
} from '~/shared/httpCollection'
import { maskHttpSecretVariables } from '~/shared/httpVariables'
import { useHttpApp } from './useHttpApp'
import { useHttpCollection } from './useHttpCollection'
import { useHttpEnvironments } from './useHttpEnvironments'
import { useHttpFolders } from './useHttpFolders'
import { flattenFolderTree } from './useHttpFolderTree'
import { useHttpRequests } from './useHttpRequests'
import { useHttpSession } from './useHttpSession'
import { inspectVariables, referencedVariables } from './variableInspection'

export function useHttpVariableInspection() {
  const { httpState } = useHttpApp()
  const { collection, draft } = useHttpCollection()
  const { currentRequest, currentDraft } = useHttpRequests()
  const { folders } = useHttpFolders()
  const { activeEnvironment } = useHttpEnvironments()
  const { maskedSessionVariables } = useHttpSession()
  const isRequest = computed(
    () => !httpState.activePanel || httpState.activePanel === 'request',
  )
  const contextName = computed(() =>
    isRequest.value ? currentRequest.value?.name : collection.value?.name,
  )
  const chain = computed(() => {
    const all = flattenFolderTree(folders.value).map(folder =>
      folder.id === collection.value?.id
        ? { ...folder, collectionConfig: draft.value }
        : folder,
    )
    const id = isRequest.value
      ? currentRequest.value?.folderId
      : collection.value?.id
    try {
      return httpFolderChain(all, id)
    }
    catch {
      return []
    }
  })
  const layers = computed(() => {
    const result: VariableLayer[] = chain.value.map(folder => ({
      scope: folder.parentId === null ? 'collection' : 'folder',
      label: folder.name,
      folderId: folder.id,
      values: Object.fromEntries(
        (folder.collectionConfig?.variables ?? [])
          .filter(row => row.enabled !== false && row.key)
          .map(row => [row.key, row.value]),
      ),
    }))
    if (activeEnvironment.value) {
      result.push({
        scope: 'environment',
        label: activeEnvironment.value.name,
        values: maskHttpSecretVariables(
          activeEnvironment.value.variables as Record<string, string>,
          activeEnvironment.value.secretKeys,
        ),
      })
    }
    result.push({
      scope: 'session',
      label: i18n.t('spaces.http.runtime.session'),
      values: maskedSessionVariables.value,
    })
    return result
  })
  const used = computed(() => {
    if (!isRequest.value || !currentDraft.value)
      return []
    let config
    try {
      config = resolveHttpFolderConfig(
        chain.value,
        currentRequest.value?.folderId,
      )
    }
    catch {
      return []
    }
    const request = applyHttpCollection(currentDraft.value, config)
    return referencedVariables([
      request.url,
      request.body ?? '',
      ...request.headers
        .filter(row => row.enabled !== false)
        .map(row => row.value),
      ...(request.query ?? [])
        .filter(row => row.enabled !== false)
        .map(row => row.value),
      ...(request.formData ?? [])
        .filter(row => row.type === 'text')
        .map(row => row.value),
      request.auth.token ?? '',
      request.auth.username ?? '',
      request.auth.password ?? '',
    ])
  })
  const variables = computed(() => inspectVariables(layers.value, used.value))
  return { variables, layers, contextName, isRequest, activeEnvironment }
}
