import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  findInternalLinkElement,
  handleInternalLinkClick,
  handleInternalLinkMouseDown,
  handlePlannedLinkMouseDown,
} from '../navigation'

const { openInternalTarget } = vi.hoisted(() => ({
  openInternalTarget: vi.fn(async () => undefined),
}))

vi.mock('@/ipc/listeners/deepLinks', () => ({
  openInternalTarget,
}))

vi.mock('../trigger', () => ({ getPlannedLinkActions: vi.fn() }))

vi.mock('@/utils', () => ({
  isMac: true,
}))

function createLinkElement(dataset: Record<string, string>) {
  return {
    dataset,
  } as unknown as HTMLElement
}

function createSvgTarget(link: HTMLElement) {
  return {
    closest: vi.fn((selector: string) =>
      selector === '[data-internal-link="true"]' ? link : null,
    ),
  } as unknown as Element
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('findInternalLinkElement', () => {
  it('resolves the link element even when the event target is an svg child', () => {
    const link = createLinkElement({
      internalLinkBroken: 'false',
    })

    expect(findInternalLinkElement(createSvgTarget(link))).toBe(link)
  })
})

describe('handleInternalLinkMouseDown', () => {
  it('navigates on meta+mousedown before CodeMirror handles the click', () => {
    const preventDefault = vi.fn()
    const dispatch = vi.fn()

    const handled = handleInternalLinkMouseDown(
      { dispatch } as any,
      {
        ctrlKey: false,
        metaKey: true,
        preventDefault,
      } as unknown as MouseEvent,
      createLinkElement({
        internalLinkBroken: 'false',
        internalLinkFrom: '10',
        internalLinkId: '15',
        internalLinkType: 'note',
      }),
    )

    expect(handled).toBe(true)
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(dispatch).not.toHaveBeenCalled()
    expect(openInternalTarget).toHaveBeenCalledWith({ id: 15, type: 'note' })
  })

  it('navigates to HTTP request links', () => {
    const preventDefault = vi.fn()
    const dispatch = vi.fn()

    const handled = handleInternalLinkMouseDown(
      { dispatch } as any,
      {
        ctrlKey: false,
        metaKey: true,
        preventDefault,
      } as unknown as MouseEvent,
      createLinkElement({
        internalLinkBroken: 'false',
        internalLinkFrom: '10',
        internalLinkId: '8',
        internalLinkType: 'http-request',
      }),
    )

    expect(handled).toBe(true)
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(dispatch).not.toHaveBeenCalled()
    expect(openInternalTarget).toHaveBeenCalledWith({
      id: 8,
      type: 'http-request',
    })
  })

  it('moves caret into the raw link on plain mousedown', () => {
    const preventDefault = vi.fn()
    const dispatch = vi.fn()
    const focus = vi.fn()

    const handled = handleInternalLinkMouseDown(
      { dispatch, focus } as any,
      {
        ctrlKey: false,
        metaKey: false,
        preventDefault,
      } as unknown as MouseEvent,
      createLinkElement({
        internalLinkBroken: 'false',
        internalLinkFrom: '10',
        internalLinkId: '15',
        internalLinkType: 'note',
      }),
    )

    expect(handled).toBe(true)
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({
      selection: {
        anchor: 11,
      },
    })
    expect(focus).toHaveBeenCalledTimes(1)
    expect(openInternalTarget).not.toHaveBeenCalled()
  })
})

describe('handleInternalLinkClick', () => {
  it('suppresses the follow-up click after plain mousedown handling', () => {
    const preventDefault = vi.fn()

    const handled = handleInternalLinkClick(
      {
        preventDefault,
      } as unknown as MouseEvent,
      createLinkElement({
        internalLinkBroken: 'false',
      }),
    )

    expect(handled).toBe(true)
    expect(preventDefault).toHaveBeenCalledTimes(1)
  })
})

it.each(['note', 'snippet', 'http-request'] as const)(
  'cmd-click creates the selected %s placeholder before normal navigation',
  async (type) => {
    const { EditorState } = await import('@codemirror/state')
    const { getPlannedLinkActions } = await import('../trigger')
    const raw = `[[masscode:planned:${type}|Future]]`
    const state = EditorState.create({ doc: `${raw} ${raw}` })
    const create = vi.fn()
    vi.mocked(getPlannedLinkActions).mockReturnValue({ create })
    const view = { state, posAtCoords: () => raw.length + 2 } as any
    const event = {
      metaKey: true,
      ctrlKey: false,
      preventDefault: vi.fn(),
    } as any
    expect(handlePlannedLinkMouseDown(view, event, null)).toBe(true)
    expect(getPlannedLinkActions).toHaveBeenCalledWith(
      view,
      expect.objectContaining({
        from: raw.length + 1,
        plannedTarget: { type },
      }),
    )
    expect(create).toHaveBeenCalledOnce()
    expect(openInternalTarget).not.toHaveBeenCalled()
    expect(event.preventDefault).toHaveBeenCalledOnce()
    create.mockClear()
    event.metaKey = false
    expect(handlePlannedLinkMouseDown(view, event, null)).toBe(false)
    expect(create).not.toHaveBeenCalled()
  },
)
