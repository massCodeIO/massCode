import type {
  HttpEnvironmentCreateInput,
  HttpEnvironmentsStorage,
  HttpEnvironmentUpdateInput,
  HttpEnvironmentUpdateResult,
} from '../../../../contracts'
import type { HttpEnvironmentRecord } from '../runtime/types'
import { randomUUID } from 'node:crypto'
import { getVaultPath } from '../../runtime/paths'
import {
  assertVaultNotHydrating,
  throwStorageError,
  validateEntryName,
} from '../../runtime/validation'
import { getHttpPaths } from '../runtime/paths'
import { saveHttpState, saveHttpStateImmediate } from '../runtime/state'
import { getHttpRuntimeCache } from '../runtime/sync'

function normalizeVariables(
  raw: Record<string, string> | undefined,
  secretKeys: string[] = [],
): Record<string, string> {
  if (!raw || typeof raw !== 'object') {
    return {}
  }

  const secrets = new Set(secretKeys)
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (typeof key !== 'string' || !key.trim()) {
      continue
    }
    // Значение secret-переменной не должно попасть в .state.yaml даже если
    // клиент прислал его в обычных variables: файл уезжает в облачную папку.
    if (secrets.has(key)) {
      continue
    }
    result[key] = typeof value === 'string' ? value : ''
  }
  return result
}

export function createHttpEnvironmentsStorage(): HttpEnvironmentsStorage {
  function resolvePaths() {
    return getHttpPaths(getVaultPath())
  }

  function getCache() {
    return getHttpRuntimeCache(resolvePaths())
  }

  return {
    getEnvironments() {
      const { state } = getCache()
      return [...state.environments].sort((a, b) => a.createdAt - b.createdAt)
    },

    getActiveEnvironmentId() {
      const { state } = getCache()
      return state.activeEnvironmentId
    },

    setActiveEnvironment(id: number | null) {
      const paths = resolvePaths()
      const { state } = getHttpRuntimeCache(paths)

      if (id !== null) {
        const exists = state.environments.some(env => env.id === id)
        if (!exists) {
          return { notFound: true }
        }
      }

      state.activeEnvironmentId = id
      saveHttpState(paths, state)
      return { notFound: false }
    },

    createEnvironment(input: HttpEnvironmentCreateInput) {
      const paths = resolvePaths()
      const { state } = getHttpRuntimeCache(paths)

      assertVaultNotHydrating(state)
      const name = validateEntryName(input.name, 'folder')
      const conflict = state.environments.some(
        env => env.name.toLowerCase() === name.toLowerCase(),
      )
      if (conflict) {
        throwStorageError(
          'NAME_CONFLICT',
          'Environment with this name already exists',
        )
      }

      state.counters.environmentId += 1
      const id = state.counters.environmentId
      const now = Date.now()
      const record: HttpEnvironmentRecord = {
        createdAt: now,
        id,
        name,
        secretStorageId: randomUUID(),
        updatedAt: now,
        variables: normalizeVariables(input.variables),
      }
      state.environments.push(record)

      saveHttpState(paths, state)
      return { id }
    },

    updateEnvironment(
      id: number,
      input: HttpEnvironmentUpdateInput,
    ): HttpEnvironmentUpdateResult {
      const paths = resolvePaths()
      const { state } = getHttpRuntimeCache(paths)
      const env = state.environments.find(item => item.id === id)

      if (!env) {
        return { invalidInput: false, notFound: true }
      }

      if (input.name === undefined && input.variables === undefined) {
        return { invalidInput: true, notFound: false }
      }

      if (input.name !== undefined) {
        const nextName = validateEntryName(input.name, 'folder')
        const conflict = state.environments.some(
          item =>
            item.id !== id
            && item.name.toLowerCase() === nextName.toLowerCase(),
        )
        if (conflict) {
          throwStorageError(
            'NAME_CONFLICT',
            'Environment with this name already exists',
          )
        }
        env.name = nextName
      }

      if (input.variables !== undefined) {
        env.variables = normalizeVariables(input.variables, env.secretKeys)
      }

      env.updatedAt = Date.now()
      saveHttpState(paths, state)
      return { invalidInput: false, notFound: false }
    },

    addSecretKey(id: number, key: string) {
      const paths = resolvePaths()
      const { state } = getHttpRuntimeCache(paths)

      assertVaultNotHydrating(state)
      const env = state.environments.find(item => item.id === id)
      if (!env) {
        return { notFound: true }
      }

      const previousVariables = env.variables
      const previousSecretKeys = env.secretKeys
      const previousUpdatedAt = env.updatedAt
      const secretKeys = new Set(previousSecretKeys ?? [])
      secretKeys.add(key)
      env.secretKeys = [...secretKeys]
      // Переменная перестала быть обычной: её plain-значение уходит из vault.
      env.variables = { ...env.variables }
      delete env.variables[key]
      env.updatedAt = Date.now()

      try {
        saveHttpStateImmediate(paths, state)
      }
      catch (error) {
        env.variables = previousVariables
        env.secretKeys = previousSecretKeys
        env.updatedAt = previousUpdatedAt
        saveHttpState(paths, state)
        throw error
      }
      return { notFound: false }
    },

    removeSecretKey(id: number, key: string) {
      const paths = resolvePaths()
      const { state } = getHttpRuntimeCache(paths)

      assertVaultNotHydrating(state)
      const env = state.environments.find(item => item.id === id)
      if (!env) {
        return { notFound: true }
      }

      const previousSecretKeys = env.secretKeys
      const previousUpdatedAt = env.updatedAt
      const secretKeys = (previousSecretKeys ?? []).filter(
        item => item !== key,
      )
      if (secretKeys.length > 0) {
        env.secretKeys = secretKeys
      }
      else {
        delete env.secretKeys
      }
      env.updatedAt = Date.now()

      try {
        saveHttpStateImmediate(paths, state)
      }
      catch (error) {
        env.secretKeys = previousSecretKeys
        env.updatedAt = previousUpdatedAt
        saveHttpState(paths, state)
        throw error
      }
      return { notFound: false }
    },

    unprotectSecret(id: number, key: string, value: string) {
      const paths = resolvePaths()
      const { state } = getHttpRuntimeCache(paths)

      assertVaultNotHydrating(state)
      const env = state.environments.find(item => item.id === id)
      if (!env) {
        return { notFound: true }
      }

      const previousVariables = env.variables
      const previousSecretKeys = env.secretKeys
      const previousUpdatedAt = env.updatedAt
      env.variables = { ...env.variables, [key]: value }
      const secretKeys = (env.secretKeys ?? []).filter(item => item !== key)
      if (secretKeys.length > 0) {
        env.secretKeys = secretKeys
      }
      else {
        delete env.secretKeys
      }
      env.updatedAt = Date.now()

      try {
        saveHttpStateImmediate(paths, state)
      }
      catch (error) {
        env.variables = previousVariables
        env.secretKeys = previousSecretKeys
        env.updatedAt = previousUpdatedAt
        saveHttpState(paths, state)
        throw error
      }
      return { notFound: false }
    },

    deleteEnvironment(id: number) {
      const paths = resolvePaths()
      const { state } = getHttpRuntimeCache(paths)
      const index = state.environments.findIndex(item => item.id === id)

      if (index === -1) {
        return { deleted: false }
      }

      const [removed] = state.environments.splice(index, 1)
      const previousActiveEnvironmentId = state.activeEnvironmentId
      if (state.activeEnvironmentId === id) {
        state.activeEnvironmentId = null
      }

      try {
        saveHttpStateImmediate(paths, state)
      }
      catch (error) {
        state.environments.splice(index, 0, removed!)
        state.activeEnvironmentId = previousActiveEnvironmentId
        saveHttpState(paths, state)
        throw error
      }
      return {
        deleted: true,
        secretScopeId: removed!.secretStorageId ?? String(removed!.id),
      }
    },
  }
}
