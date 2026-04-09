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
    expect(setScrollTop).toHaveBeenCalledWith(320)
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
})
