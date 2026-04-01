import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleInternalLinkNavigationMouseDown } from '../navigation'

const { openInternalTarget } = vi.hoisted(() => ({
  openInternalTarget: vi.fn(async () => undefined),
}))

vi.mock('@/ipc/listeners/deepLinks', () => ({
  openInternalTarget,
}))

vi.mock('@/utils', () => ({
  isMac: true,
}))

function createLinkElement(dataset: Record<string, string>) {
  return {
    dataset,
  } as unknown as HTMLElement
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('handleInternalLinkNavigationMouseDown', () => {
  it('navigates on meta+mousedown before CodeMirror handles the click', () => {
    const preventDefault = vi.fn()

    const handled = handleInternalLinkNavigationMouseDown(
      {
        ctrlKey: false,
        metaKey: true,
        preventDefault,
      } as unknown as MouseEvent,
      createLinkElement({
        internalLinkBroken: 'false',
        internalLinkId: '15',
        internalLinkType: 'note',
      }),
    )

    expect(handled).toBe(true)
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(openInternalTarget).toHaveBeenCalledWith({ id: 15, type: 'note' })
  })

  it('does nothing on plain mousedown', () => {
    const preventDefault = vi.fn()

    const handled = handleInternalLinkNavigationMouseDown(
      {
        ctrlKey: false,
        metaKey: false,
        preventDefault,
      } as unknown as MouseEvent,
      createLinkElement({
        internalLinkBroken: 'false',
        internalLinkId: '15',
        internalLinkType: 'note',
      }),
    )

    expect(handled).toBe(false)
    expect(preventDefault).not.toHaveBeenCalled()
    expect(openInternalTarget).not.toHaveBeenCalled()
  })
})
