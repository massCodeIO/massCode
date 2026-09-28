import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'

const invoke = vi.fn()
const appStore = new Map<string, unknown>()
const markPersistedStorageMutation = vi.fn()
const markUserEdit = vi.fn()
const routerPush = vi.fn()

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('nextTick', nextTick)

vi.mock('@/electron', () => ({
  ipc: {
    invoke,
  },
  store: {
    app: {
      get: (key: string) => appStore.get(key),
      set: (key: string, value: unknown) => appStore.set(key, value),
    },
  },
}))

vi.mock('@/router', () => ({
  router: {
    push: routerPush,
  },
  RouterName: {
    drawingsSpace: 'drawings-space',
  },
}))

vi.mock('@/composables/useDonations', () => ({
  useDonations: () => ({
    incrementCreated: vi.fn(),
  }),
}))

vi.mock('@/composables/useStorageMutation', () => ({
  markPersistedStorageMutation,
  markUserEdit,
}))

describe('useDrawings', () => {
  const drawing = {
    id: 'Sketch',
    name: 'Sketch',
    createdAt: 1,
    updatedAt: 1,
  }
  const otherDrawing = {
    id: 'Other',
    name: 'Other',
    createdAt: 1,
    updatedAt: 1,
  }
  const emptyContent = '{"type":"excalidraw","elements":[]}'
  const otherContent = '{"type":"excalidraw","elements":[{"id":"other"}]}'
  const updatedContent = '{"type":"excalidraw","elements":[{"id":"shape"}]}'

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    appStore.clear()
    vi.stubGlobal('window', {
      dispatchEvent: vi.fn(),
    })
    vi.stubGlobal(
      'CustomEvent',
      class {
        detail: unknown
        type: string

        constructor(type: string, init?: { detail?: unknown }) {
          this.type = type
          this.detail = init?.detail
        }
      },
    )
  })

  it('keeps active drawing content current while an IPC save is pending', async () => {
    let resolveWrite: ((value: { updatedAt: number }) => void) | undefined

    invoke.mockImplementation((channel: string) => {
      if (channel === 'spaces:drawings:list') {
        return Promise.resolve([drawing])
      }

      if (channel === 'spaces:drawings:read') {
        return Promise.resolve(emptyContent)
      }

      if (channel === 'spaces:drawings:write') {
        return new Promise<{ updatedAt: number }>((resolve) => {
          resolveWrite = resolve
        })
      }

      return Promise.resolve(null)
    })

    const { useDrawings } = await import('../useDrawings')
    const drawings = useDrawings()

    await drawings.init()

    expect(drawings.activeDrawingContent.value).toBe(emptyContent)

    const savePromise = drawings.saveDrawingContent(drawing.id, updatedContent)

    expect(drawings.activeDrawingContent.value).toBe(updatedContent)
    expect(markUserEdit).toHaveBeenCalledTimes(1)

    resolveWrite?.({ updatedAt: 2 })
    await savePromise

    expect(drawings.activeDrawingContent.value).toBe(updatedContent)
  })

  it('uses pending content when a drawing is reselected before its save finishes', async () => {
    let resolveWrite: ((value: { updatedAt: number }) => void) | undefined
    const savedContentById: Record<string, string> = {
      [drawing.id]: emptyContent,
      [otherDrawing.id]: otherContent,
    }

    invoke.mockImplementation((channel: string, payload?: { id?: string }) => {
      if (channel === 'spaces:drawings:list') {
        return Promise.resolve([drawing, otherDrawing])
      }

      if (channel === 'spaces:drawings:read' && payload?.id) {
        return Promise.resolve(savedContentById[payload.id])
      }

      if (channel === 'spaces:drawings:write') {
        return new Promise<{ updatedAt: number }>((resolve) => {
          resolveWrite = resolve
        })
      }

      return Promise.resolve(null)
    })

    const { useDrawings } = await import('../useDrawings')
    const drawings = useDrawings()

    await drawings.init()

    const savePromise = drawings.saveDrawingContent(drawing.id, updatedContent)

    await drawings.selectDrawing(otherDrawing.id)
    await drawings.selectDrawing(drawing.id)

    expect(drawings.activeDrawingContent.value).toBe(updatedContent)

    savedContentById[drawing.id] = updatedContent
    resolveWrite?.({ updatedAt: 2 })
    await savePromise
  })
})
