import { EditorView } from '@codemirror/view'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('useNavigationUIState', () => {
  beforeEach(async () => {
    vi.resetModules()

    const module = await import('../useNavigationUIState')
    module.clearNavigationUIStateForTests()
  })

  it('captures note editor scroll from the registered note controller', async () => {
    const module = await import('../useNavigationUIState')

    module.registerNavigationNoteUIState(15, {
      getScrollTop: () => 240,
      setScrollTop: vi.fn(),
    })

    expect(
      module.captureNavigationUIState({
        id: 15,
        name: 'Note',
        type: 'note',
      }),
    ).toEqual({ scrollTop: 240 })
  })

  it('preserves the editor scroll effect through capture and restore', async () => {
    const module = await import('../useNavigationUIState')
    const snapshot = {
      effect: EditorView.scrollIntoView(120, { y: 'start', yMargin: -12 }),
      anchor: 120,
      offset: -12,
    }
    const setScrollTop = vi.fn()
    module.registerNavigationNoteUIState(15, {
      getScrollTop: () => 320,
      getScrollSnapshot: () => snapshot,
      setScrollTop,
    })
    const entry = { id: 15, name: 'Note', type: 'note' as const }
    const uiState = module.captureNavigationUIState(entry)
    module.queueNavigationUIStateRestore({ ...entry, uiState })
    expect(setScrollTop).toHaveBeenCalledWith(320, snapshot)
  })

  it('queues and restores note scroll when the note controller becomes available', async () => {
    const module = await import('../useNavigationUIState')
    const setScrollTop = vi.fn()

    module.queueNavigationUIStateRestore({
      id: 15,
      name: 'Note',
      type: 'note',
      uiState: { scrollTop: 320 },
    })

    expect(module.applyPendingNavigationUIStateForNote(15)).toBe(false)

    module.registerNavigationNoteUIState(15, {
      getScrollTop: () => 0,
      setScrollTop,
    })

    expect(module.applyPendingNavigationUIStateForNote(15)).toBe(true)
    expect(setScrollTop).toHaveBeenCalledWith(320, undefined)
    expect(module.applyPendingNavigationUIStateForNote(15)).toBe(false)
  })

  it('queues and restores route scroll for dashboard containers', async () => {
    const module = await import('../useNavigationUIState')
    const setScrollTop = vi.fn()

    module.queueNavigationUIStateRestore({
      routeName: 'notes-space/dashboard',
      type: 'route',
      uiState: { scrollTop: 560 },
    })

    module.registerNavigationRouteUIState('notes-space/dashboard', {
      getScrollTop: () => 0,
      setScrollTop,
    })

    expect(
      module.applyPendingNavigationUIStateForRoute('notes-space/dashboard'),
    ).toBe(true)
    expect(setScrollTop).toHaveBeenCalledWith(560)
  })

  it('restores scroll when navigation finishes after the editor has mounted', async () => {
    const module = await import('../useNavigationUIState')
    const setScrollTop = vi.fn()
    module.registerNavigationNoteUIState(15, {
      getScrollTop: () => 0,
      setScrollTop,
    })

    module.queueNavigationUIStateRestore({
      id: 15,
      name: 'Note',
      type: 'note',
      uiState: { scrollTop: 320 },
    })

    expect(setScrollTop).toHaveBeenCalledWith(320, undefined)
    expect(module.applyPendingNavigationUIStateForNote(15)).toBe(false)
  })

  it('does not apply a cancelled restore when the editor mounts later', async () => {
    const module = await import('../useNavigationUIState')
    const setScrollTop = vi.fn()
    module.queueNavigationUIStateRestore({
      id: 15,
      name: 'Note',
      type: 'note',
      uiState: { scrollTop: 320 },
    })
    module.clearPendingNavigationUIStateRestore()
    module.registerNavigationNoteUIState(15, {
      getScrollTop: () => 0,
      setScrollTop,
    })

    expect(module.applyPendingNavigationUIStateForNote(15)).toBe(false)
    expect(setScrollTop).not.toHaveBeenCalled()
  })
})
