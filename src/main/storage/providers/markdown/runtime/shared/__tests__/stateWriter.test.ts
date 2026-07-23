import type { Stats } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  enqueueCloudDownload,
  prioritizeCloudDownload,
} from '../../../cloudDownloads'
import {
  pendingStateWriteByPath,
  stateContentCacheByPath,
  stateFlushTimerByPath,
} from '../../cache'
import {
  resetCloudFileExemptions,
  setDatalessProbeForTests,
} from '../cloudFiles'
import { createStateAdapter } from '../stateAdapter'
import { scheduleStateFlush } from '../stateWriter'

vi.mock('../../../cloudDownloads', () => ({
  enqueueCloudDownload: vi.fn(),
  prioritizeCloudDownload: vi.fn(),
}))

const tempDirs: string[] = []

function createStatePath(): string {
  const dirPath = fs.mkdtempSync(path.join(os.tmpdir(), 'state-writer-'))
  tempDirs.push(dirPath)
  return path.join(dirPath, '.masscode', 'state.json')
}

function mockZeroBlockStateFile(statePath: string): void {
  const statSync = fs.statSync.bind(fs)

  vi.spyOn(fs, 'statSync').mockImplementation((filePath) => {
    const stats = statSync(filePath)

    if (filePath === statePath && stats.size > 0) {
      return Object.assign(stats, { blocks: 0 }) as Stats
    }

    return stats
  })
}

afterEach(() => {
  for (const timer of stateFlushTimerByPath.values()) {
    clearTimeout(timer)
  }

  pendingStateWriteByPath.clear()
  stateContentCacheByPath.clear()
  stateFlushTimerByPath.clear()
  setDatalessProbeForTests(null)
  resetCloudFileExemptions()
  vi.clearAllMocks()
  vi.restoreAllMocks()

  for (const dirPath of tempDirs.splice(0)) {
    fs.removeSync(dirPath)
  }
})

describe('stateWriter cloud placeholder guard', () => {
  it('keeps an app-written zero-block state file writable', () => {
    const statePath = createStatePath()
    mockZeroBlockStateFile(statePath)
    setDatalessProbeForTests(() => true)

    scheduleStateFlush(statePath, '{"version":1}\n', { immediate: true })
    scheduleStateFlush(statePath, '{"version":2}\n', { immediate: true })

    expect(fs.readFileSync(statePath, 'utf8')).toBe('{"version":2}\n')
    expect(enqueueCloudDownload).not.toHaveBeenCalled()
    expect(pendingStateWriteByPath.has(statePath)).toBe(false)
  })

  it('does not overwrite a pre-existing cloud placeholder', () => {
    const statePath = createStatePath()
    fs.ensureDirSync(path.dirname(statePath))
    fs.writeFileSync(statePath, 'cloud state', 'utf8')
    mockZeroBlockStateFile(statePath)
    setDatalessProbeForTests(() => true)

    scheduleStateFlush(statePath, 'local state', { immediate: true })

    expect(fs.readFileSync(statePath, 'utf8')).toBe('cloud state')
    expect(pendingStateWriteByPath.get(statePath)).toBe('local state')
    expect(stateFlushTimerByPath.has(statePath)).toBe(true)
    expect(enqueueCloudDownload).toHaveBeenCalledWith(statePath)
  })
})

describe('stateAdapter default state', () => {
  it('reads a just-created zero-block default state immediately', () => {
    const statePath = createStatePath()
    mockZeroBlockStateFile(statePath)
    setDatalessProbeForTests(() => true)

    const defaultState = {
      folderUi: {},
      folders: [],
      version: 1,
    }
    const adapter = createStateAdapter<
      typeof defaultState,
      typeof defaultState,
      { statePath: string }
    >({
      createDefaultState: () => defaultState,
      getDirs: paths => [path.dirname(paths.statePath)],
      minVersion: 1,
      parseRawState: raw => raw,
      toPersistedState: state => state,
    })

    expect(adapter.loadState({ statePath })).toEqual(defaultState)
    expect(prioritizeCloudDownload).not.toHaveBeenCalled()
  })
})
