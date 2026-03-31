import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InternalLinkPreviewController } from '../preview'

vi.mock('@/electron', () => ({
  i18n: {
    t: vi.fn((key: string) => key),
  },
  ipc: {},
  store: {
    preferences: {
      get: vi.fn(() => 4321),
    },
  },
}))

vi.mock('@/services/api', () => ({
  api: {
    notes: { getNotesById: vi.fn() },
    snippets: { getSnippetsById: vi.fn() },
  },
}))

beforeEach(() => {
  vi.useFakeTimers()
})

describe('internalLinkPreviewController', () => {
  it('opens after the hover delay', () => {
    const controller = new InternalLinkPreviewController(300)
    const onOpen = vi.fn()

    controller.enterLink(true, onOpen)
    vi.advanceTimersByTime(299)
    expect(onOpen).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('does not open for broken links', () => {
    const controller = new InternalLinkPreviewController(300)
    const onOpen = vi.fn()

    controller.enterLink(false, onOpen)
    vi.advanceTimersByTime(300)
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('stays open while popup is hovered', () => {
    const controller = new InternalLinkPreviewController(300)
    const onClose = vi.fn()

    controller.enterPopup()
    controller.leaveLink(onClose)
    vi.advanceTimersByTime(300)

    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes after leaving both link and popup', () => {
    const controller = new InternalLinkPreviewController(300)
    const onClose = vi.fn()

    controller.enterPopup()
    controller.leavePopup(onClose)
    vi.advanceTimersByTime(300)

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
