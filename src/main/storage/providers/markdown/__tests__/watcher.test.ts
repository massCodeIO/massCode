import { describe, expect, it } from 'vitest'
import {
  getWatchPathSpaceId,
  isCodeWatchPath,
  isMathWatchPath,
  isNotesWatchPath,
  normalizeRelativeWatchPath,
  shouldIgnoreWatchPath,
  toCodeRelativePath,
} from '../watcherPaths'

describe('watcher routing', () => {
  const vaultRoot = '/vault'

  it('normalizes relative watch paths under the vault root', () => {
    expect(normalizeRelativeWatchPath(vaultRoot, '/vault/code/demo.md')).toBe(
      'code/demo.md',
    )
    expect(normalizeRelativeWatchPath(vaultRoot, 'notes/note.md')).toBe(
      'notes/note.md',
    )
    expect(normalizeRelativeWatchPath(vaultRoot, '/outside/file.md')).toBe(
      null,
    )
  })

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

  it('keeps known space roots observable even for dotfiles', () => {
    expect(shouldIgnoreWatchPath(vaultRoot, '/vault/code/.gitkeep')).toBe(
      false,
    )
    expect(shouldIgnoreWatchPath(vaultRoot, '/vault/notes/.obsidian')).toBe(
      false,
    )
  })

  it('ignores hidden non-space paths', () => {
    expect(shouldIgnoreWatchPath(vaultRoot, '/vault/.git/config')).toBe(true)
    expect(shouldIgnoreWatchPath(vaultRoot, '/vault/random/.cache/file')).toBe(
      true,
    )
  })

  it('recognizes code, notes and math space paths', () => {
    expect(isCodeWatchPath('code/demo.md')).toBe(true)
    expect(isCodeWatchPath('notes/demo.md')).toBe(false)
    expect(isNotesWatchPath('notes/demo.md')).toBe(true)
    expect(isMathWatchPath('math/.state.yaml')).toBe(true)
  })

  it('extracts code-relative paths only from code space entries', () => {
    expect(toCodeRelativePath('code')).toBe(null)
    expect(toCodeRelativePath('code/folder/demo.md')).toBe('folder/demo.md')
    expect(toCodeRelativePath('notes/demo.md')).toBe(null)
  })
})
