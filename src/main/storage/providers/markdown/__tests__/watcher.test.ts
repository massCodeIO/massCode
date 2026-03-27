import { describe, expect, it } from 'vitest'
import { getWatchPathSpaceId, shouldIgnoreWatchPath } from '../watcherPaths'

describe('watcher routing', () => {
  const vaultRoot = '/vault'

  it('keeps math state file observable after flat layout migration', () => {
    expect(shouldIgnoreWatchPath(vaultRoot, '/vault/math/.state.yaml')).toBe(
      false,
    )
    expect(getWatchPathSpaceId('math/.state.yaml')).toBe('math')
  })

  it('drops unknown vault-root entries from space routing', () => {
    expect(getWatchPathSpaceId('README.md')).toBe(null)
    expect(getWatchPathSpaceId('random-dir/file.md')).toBe(null)
  })
})
