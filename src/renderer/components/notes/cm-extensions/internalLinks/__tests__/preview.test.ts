import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  dismissInternalLinksPreview,
  InternalLinkPreviewController,
  internalLinksPreviewState,
  shouldCloseInternalLinksPreviewOnUpdate,
} from '../preview'

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
  internalLinksPreviewState.anchor = null
  internalLinksPreviewState.content = null
  internalLinksPreviewState.isOpen = false
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

  it('resets pending hover state when editing starts', () => {
    const controller = new InternalLinkPreviewController(300)
    const onOpen = vi.fn()

    controller.enterLink(true, onOpen)
    controller.reset()
    vi.advanceTimersByTime(300)

    expect(onOpen).not.toHaveBeenCalled()
  })
})

describe('shouldCloseInternalLinksPreviewOnUpdate', () => {
  it('closes preview when owner view changes selection or document', () => {
    expect(
      shouldCloseInternalLinksPreviewOnUpdate({
        docChanged: true,
        isOwner: true,
        selectionSet: false,
      }),
    ).toBe(true)

    expect(
      shouldCloseInternalLinksPreviewOnUpdate({
        docChanged: false,
        isOwner: true,
        selectionSet: true,
      }),
    ).toBe(true)
  })

  it('ignores unrelated updates', () => {
    expect(
      shouldCloseInternalLinksPreviewOnUpdate({
        docChanged: false,
        isOwner: true,
        selectionSet: false,
      }),
    ).toBe(false)

    expect(
      shouldCloseInternalLinksPreviewOnUpdate({
        docChanged: true,
        isOwner: false,
        selectionSet: true,
      }),
    ).toBe(false)
  })
})

describe('dismissInternalLinksPreview', () => {
  it('closes an already open preview immediately on interaction start', () => {
    internalLinksPreviewState.anchor = { left: 10, top: 20 }
    internalLinksPreviewState.content = {
      body: 'Body',
      title: 'Title',
      type: 'note',
    }
    internalLinksPreviewState.isOpen = true

    dismissInternalLinksPreview()

    expect(internalLinksPreviewState.isOpen).toBe(false)

    vi.advanceTimersByTime(180)

    expect(internalLinksPreviewState.anchor).toBeNull()
    expect(internalLinksPreviewState.content).toBeNull()
  })
})
