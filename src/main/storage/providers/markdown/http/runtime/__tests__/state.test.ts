import type { Stats } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { pendingStateWriteByPath } from '../../../runtime/cache'
import {
  resetCloudFileExemptions,
  setDatalessProbeForTests,
} from '../../../runtime/shared/cloudFiles'
import { resetStateWriter } from '../../../runtime/shared/stateWriter'
import {
  createDefaultHttpState,
  loadHttpState,
  saveHttpStateImmediate,
} from '../state'

vi.mock('../../../cloudDownloads', () => ({
  enqueueCloudDownload: vi.fn(),
  prioritizeCloudDownload: vi.fn(),
}))

const tempDirs: string[] = []

afterEach(() => {
  resetStateWriter()
  resetCloudFileExemptions()
  setDatalessProbeForTests(null)
  vi.restoreAllMocks()
  for (const dir of tempDirs.splice(0)) {
    fs.removeSync(dir)
  }
})

describe('saveHttpStateImmediate', () => {
  it.each(['[{ id: 1, requestId: null }]', '{ damaged: true }'])(
    'preserves legacy history before the history store is opened: %s',
    (history) => {
      const httpRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), 'http-state-legacy-'),
      )
      tempDirs.push(httpRoot)
      const paths = { httpRoot, statePath: path.join(httpRoot, '.state.yaml') }
      fs.writeFileSync(paths.statePath, `version: 2\nhistory: ${history}\n`)
      const state = loadHttpState(paths)
      const source = state.history
      state.activeEnvironmentId = 2
      saveHttpStateImmediate(paths, state)
      expect(loadHttpState(paths).history).toEqual(source)
      expect(loadHttpState(paths).activeEnvironmentId).toBe(2)
    },
  )

  it('rejects an unresolved cloud-placeholder flush', () => {
    const httpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'http-state-'))
    tempDirs.push(httpRoot)
    const statePath = path.join(httpRoot, '.state.yaml')
    fs.writeFileSync(statePath, 'cloud state', 'utf8')

    const statSync = fs.statSync.bind(fs)
    vi.spyOn(fs, 'statSync').mockImplementation((filePath) => {
      const stats = statSync(filePath)
      return filePath === statePath
        ? (Object.assign(stats, { blocks: 0 }) as Stats)
        : stats
    })
    setDatalessProbeForTests(() => true)

    expect(() =>
      saveHttpStateImmediate({ httpRoot, statePath }, createDefaultHttpState()),
    ).toThrow('HTTP_STATE_FLUSH_UNRESOLVED')
    expect(pendingStateWriteByPath.has(statePath)).toBe(true)
    expect(fs.readFileSync(statePath, 'utf8')).toBe('cloud state')
  })
})
