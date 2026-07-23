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
import { STATE_WRITE_DEBOUNCE_MS } from '../../constants'
import {
  resetCloudFileExemptions,
  setDatalessProbeForTests,
} from '../cloudFiles'
import { createStateAdapter } from '../stateAdapter'
import {
  flushPendingStateWrites,
  flushPendingStateWritesOrThrow,
  resetStateWriter,
  scheduleStateFlush,
} from '../stateWriter'

vi.mock('../../../cloudDownloads', () => ({
  enqueueCloudDownload: vi.fn(),
  prioritizeCloudDownload: vi.fn(),
}))

vi.mock('../../../../../../utils', () => ({
  log: vi.fn(),
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
  resetStateWriter()
  setDatalessProbeForTests(null)
  resetCloudFileExemptions()
  vi.useRealTimers()
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

  it('cancels placeholder retries and clears writer state on reset', () => {
    vi.useFakeTimers()
    const statePath = createStatePath()
    fs.ensureDirSync(path.dirname(statePath))
    fs.writeFileSync(statePath, 'cloud state', 'utf8')
    mockZeroBlockStateFile(statePath)
    setDatalessProbeForTests(() => true)

    scheduleStateFlush(statePath, 'local state', { immediate: true })
    expect(enqueueCloudDownload).toHaveBeenCalledTimes(1)

    resetStateWriter()
    vi.advanceTimersByTime(5_000)

    expect(enqueueCloudDownload).toHaveBeenCalledTimes(1)
    expect(pendingStateWriteByPath.size).toBe(0)
    expect(stateContentCacheByPath.size).toBe(0)
    expect(stateFlushTimerByPath.size).toBe(0)
  })

  it('continues flushing other paths after an I/O error', () => {
    vi.useFakeTimers()
    const failedStatePath = createStatePath()
    const successfulStatePath = createStatePath()
    const writeFileSync = fs.writeFileSync.bind(fs)

    scheduleStateFlush(failedStatePath, 'failed state')
    scheduleStateFlush(successfulStatePath, 'successful state')
    vi.spyOn(fs, 'writeFileSync').mockImplementation(
      (filePath, data, options) => {
        if (filePath === failedStatePath) {
          const error = new Error('write failed') as NodeJS.ErrnoException
          error.code = 'EIO'
          throw error
        }
        return writeFileSync(filePath, data, options)
      },
    )

    const result = flushPendingStateWrites()

    expect(result.errors).toEqual([
      expect.objectContaining({
        error: expect.objectContaining({ code: 'EIO' }),
        statePath: failedStatePath,
      }),
    ])
    expect(result.unresolvedPaths).toEqual([failedStatePath])
    expect(pendingStateWriteByPath.get(failedStatePath)).toBe('failed state')
    expect(stateFlushTimerByPath.has(failedStatePath)).toBe(true)
    expect(pendingStateWriteByPath.has(successfulStatePath)).toBe(false)
    expect(stateFlushTimerByPath.has(successfulStatePath)).toBe(false)
    expect(fs.readFileSync(successfulStatePath, 'utf8')).toBe(
      'successful state',
    )

    let thrownError: Error | null = null
    try {
      flushPendingStateWritesOrThrow()
    }
    catch (error) {
      thrownError = error as Error
    }
    expect(thrownError?.message).toBe(
      `Pending state writes remain for: ${failedStatePath}`,
    )
    expect(thrownError?.cause).toBeInstanceOf(AggregateError)
  })

  it('replaces a failed debounce timer with a retry and clears it on success', () => {
    vi.useFakeTimers()
    const statePath = createStatePath()
    const writeFileSync = fs.writeFileSync.bind(fs)
    const writeError = new Error('write failed') as NodeJS.ErrnoException
    writeError.code = 'EIO'
    vi.spyOn(fs, 'writeFileSync')
      .mockImplementationOnce(() => {
        throw writeError
      })
      .mockImplementation(writeFileSync)

    scheduleStateFlush(statePath, 'next state')
    const debounceTimer = stateFlushTimerByPath.get(statePath)

    vi.advanceTimersByTime(STATE_WRITE_DEBOUNCE_MS)

    const retryTimer = stateFlushTimerByPath.get(statePath)
    expect(retryTimer).toBeDefined()
    expect(retryTimer).not.toBe(debounceTimer)
    expect(pendingStateWriteByPath.get(statePath)).toBe('next state')

    vi.advanceTimersByTime(5_000)

    expect(fs.readFileSync(statePath, 'utf8')).toBe('next state')
    expect(pendingStateWriteByPath.has(statePath)).toBe(false)
    expect(stateFlushTimerByPath.has(statePath)).toBe(false)
  })

  it('flushes a placeholder after it is hydrated before the retry', () => {
    vi.useFakeTimers()
    const statePath = createStatePath()
    fs.ensureDirSync(path.dirname(statePath))
    fs.writeFileSync(statePath, 'cloud state', 'utf8')
    mockZeroBlockStateFile(statePath)
    let isPlaceholder = true
    setDatalessProbeForTests(() => isPlaceholder)

    scheduleStateFlush(statePath, 'local state', { immediate: true })
    isPlaceholder = false
    vi.advanceTimersByTime(5_000)

    expect(fs.readFileSync(statePath, 'utf8')).toBe('local state')
    expect(pendingStateWriteByPath.has(statePath)).toBe(false)
    expect(stateFlushTimerByPath.has(statePath)).toBe(false)
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
