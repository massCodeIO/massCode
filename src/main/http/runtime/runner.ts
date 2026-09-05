import type { HttpRunStart, HttpRunView } from '../../../shared/httpRunner'
import type { HttpExecutePayload } from '../../types/http'
import type { ResolvedEnvironment } from './execute'
import { randomUUID } from 'node:crypto'
import {
  emptyHttpRuntime,
  httpRuntimeSchema,
} from '../../../shared/httpRuntime'
import { useHttpStorage } from '../../storage'
import { getVaultPath } from '../../storage/providers/markdown/runtime/paths'
import { executeHttpRequest, resolveEnvironment } from './execute'
import {
  beginHttpExecution,
  finishHttpExecution,
  getHttpSession,
  isHttpSessionCurrent,
} from './session'

interface Run {
  owner: number
  view: HttpRunView
  requests: Map<number, HttpExecutePayload>
  vaultPath: string
  environmentId: number | null
  environment: ResolvedEnvironment
  generation: number
  controller: AbortController
  disposed?: boolean
}
let run: Run | null = null

function owned(owner: number, runId: string): Run {
  if (!run || run.owner !== owner || run.view.runId !== runId)
    throw new Error('HTTP_RUN_NOT_FOUND')
  return run
}

export function prepareHttpRun(owner: number, folderId: number): HttpRunView {
  if (run?.view.state === 'running')
    throw new Error('HTTP_REQUEST_RUNNING')
  run = null
  const storage = useHttpStorage()
  const folders = storage.folders.getFolders()
  const root = folders.find(folder => folder.id === folderId)
  if (!root)
    throw new Error('HTTP_RUN_FOLDER_MISSING')
  const records = storage.requests.getRequests({
    isDeleted: 0,
    sort: 'createdAt',
    order: 'ASC',
  })
  const requests = new Map<number, HttpExecutePayload>()
  const steps: HttpRunView['steps'] = []
  const visited = new Set<number>()
  const environmentId = storage.environments.getActiveEnvironmentId()
  const vaultPath = getVaultPath()
  function visit(id: number, folderPath: string) {
    if (visited.has(id))
      throw new Error('HTTP_RUN_INVALID_FOLDER')
    visited.add(id)
    for (const record of records
      .filter(
        item =>
          item.folderId === id
          && !item.isDeleted
          && item.protocol !== 'websocket',
      )
      .sort((a, b) => a.createdAt - b.createdAt || a.id - b.id)) {
      if (steps.length >= 500)
        throw new Error('HTTP_RUN_TOO_LARGE')
      const full = storage.requests.getRequestById(record.id)
      if (
        !full
        || full.isDeleted
        || full.pendingCloudDownload
        || full.runtimeState !== 'ready'
      ) {
        throw new Error('HTTP_RUN_REQUEST_UNAVAILABLE')
      }
      const runtime = httpRuntimeSchema.safeParse(
        full.runtime ?? emptyHttpRuntime(),
      )
      if (!runtime.success)
        throw new Error('HTTP_RUN_REQUEST_UNAVAILABLE')
      requests.set(
        full.id,
        structuredClone({
          requestId: full.id,
          environmentId,
          runtime: runtime.data,
          request: {
            method: full.method,
            url: full.url,
            headers: full.headers,
            query: full.query,
            auth: full.auth,
            bodyType: full.bodyType,
            body: full.body,
            formData: full.formData,
          },
        }),
      )
      steps.push({
        requestId: full.id,
        name: full.name,
        folderPath,
        method: full.method,
        state: 'pending',
      })
    }
    for (const child of folders
      .filter(folder => folder.parentId === id)
      .sort(
        (a, b) =>
          a.orderIndex - b.orderIndex
          || a.createdAt - b.createdAt
          || a.id - b.id,
      )) {
      visit(child.id, `${folderPath} / ${child.name}`)
    }
  }
  visit(root.id, root.name)
  if (!steps.length)
    throw new Error('HTTP_RUN_EMPTY')
  const environment = resolveEnvironment(environmentId)
  run = {
    owner,
    requests,
    environmentId,
    environment,
    vaultPath,
    generation: getHttpSession(vaultPath, environmentId).generation,
    controller: new AbortController(),
    view: {
      runId: randomUUID(),
      folderName: root.name,
      environmentName:
        storage.environments
          .getEnvironments()
          .find(env => env.id === environmentId)
          ?.name ?? null,
      state: 'ready',
      steps,
    },
  }
  return structuredClone(run.view)
}

export function getHttpRun(owner: number, runId: string): HttpRunView {
  return structuredClone(owned(owner, runId).view)
}

export function cancelHttpRun(owner: number, runId: string): void {
  owned(owner, runId).controller.abort()
}

export function disposeHttpRun(owner: number): void {
  if (run?.owner !== owner)
    return
  run.controller.abort()
  run.disposed = true
  if (run.view.state !== 'running')
    run = null
}

export async function startHttpRun(
  owner: number,
  options: HttpRunStart,
): Promise<HttpRunView> {
  const active = owned(owner, options.runId)
  if (active.view.state !== 'ready' || active.controller.signal.aborted)
    throw new Error('HTTP_RUN_NOT_READY')
  const ids = options.requestIds
  if (
    ids.length !== active.requests.size
    || new Set(ids).size !== ids.length
    || ids.some(id => !active.requests.has(id))
  ) {
    throw new Error('HTTP_RUN_INVALID_ORDER')
  }
  const current = () => {
    try {
      return (
        getVaultPath() === active.vaultPath
        && useHttpStorage().environments.getActiveEnvironmentId()
        === active.environmentId
        && isHttpSessionCurrent(active.generation)
      )
    }
    catch {
      return false
    }
  }
  if (!current())
    throw new Error('HTTP_CONTEXT_CHANGED')
  if (!beginHttpExecution())
    throw new Error('HTTP_REQUEST_RUNNING')
  active.view.steps = ids.map(
    id => active.view.steps.find(step => step.requestId === id)!,
  )
  active.view.state = 'running'
  const variables: Record<string, string> = Object.create(null)
  const timer = setInterval(() => {
    if (!current())
      active.controller.abort()
  }, 100)
  try {
    for (const step of active.view.steps) {
      if (active.controller.signal.aborted || !current()) {
        active.view.state = 'cancelled'
        break
      }
      step.state = 'running'
      try {
        const result = await executeHttpRequest(
          {
            ...active.requests.get(step.requestId)!,
            skipCertificateVerification: options.skipCertificateVerification,
          },
          {
            environment: active.environment,
            variables,
            signal: active.controller.signal,
            isCurrent: current,
          },
        )
        if (
          result.discarded
          || active.controller.signal.aborted
          || !current()
        ) {
          step.state = 'cancelled'
          active.view.state = 'cancelled'
          break
        }
        step.scripts = result.scriptResults
        step.status = result.status
        step.durationMs = result.durationMs
        step.assertions = result.runtimeResults?.assertions ?? []
        step.extractions = result.runtimeResults?.extractions ?? []
        if (result.error)
          step.error = 'transport'
        const failed
          = !!result.error
            || !!step.scripts?.some(
              phase => phase.error || phase.tests.some(test => !test.ok),
            )
            || result.status === null
            || result.status >= 400
            || [...step.assertions, ...step.extractions].some(check => !check.ok)
        step.state = failed ? 'failed' : 'passed'
      }
      catch {
        step.state
          = active.controller.signal.aborted || !current()
            ? 'cancelled'
            : 'failed'
        step.error = current() ? 'transport' : 'contextChanged'
      }
      if (step.state === 'cancelled') {
        active.view.state = 'cancelled'
        break
      }
      if (step.state === 'failed' && !options.continueOnFailure)
        break
    }
    if (active.view.state === 'running') {
      active.view.state = active.view.steps.some(
        step => step.state === 'failed',
      )
        ? 'failed'
        : 'passed'
    }
    for (const step of active.view.steps) {
      if (step.state === 'pending')
        step.state = 'skipped'
    }
    return structuredClone(active.view)
  }
  finally {
    clearInterval(timer)
    for (const key of Object.keys(variables)) delete variables[key]
    active.requests.clear()
    active.environment = {
      variables: {},
      maskedVariables: {},
      secretValues: [],
    }
    if (active.disposed && run === active)
      run = null
    finishHttpExecution()
  }
}
