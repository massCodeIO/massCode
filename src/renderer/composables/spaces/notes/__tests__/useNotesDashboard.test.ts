import { beforeEach, describe, expect, it, vi } from 'vitest'

async function setup(savedWidgets?: Record<string, boolean>) {
  vi.resetModules()

  const vue = await import('vue')
  Object.assign(globalThis, {
    computed: vue.computed,
    ref: vue.ref,
    shallowRef: vue.shallowRef,
    watch: vue.watch,
  })

  const getDashboard = vi.fn()
  const push = vi.fn(async () => undefined)
  const storeGet = vi.fn(() => savedWidgets)
  const storeSet = vi.fn()

  vi.doMock('@/services/api', () => ({
    api: {
      notes: {
        getNotesDashboard: getDashboard,
      },
    },
  }))

  vi.doMock('@/router', () => ({
    RouterName: {
      notesGraph: 'notes-space/graph',
    },
    router: {
      push,
    },
  }))

  vi.doMock('@/electron', () => ({
    store: {
      app: {
        get: storeGet,
        set: storeSet,
      },
    },
  }))

  const module = await import('../useNotesDashboard')
  const context = module.useNotesDashboard()

  return {
    context,
    getDashboard,
    push,
    storeGet,
    storeSet,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useNotesDashboard', () => {
  it('drops legacy activity summary widget from persisted settings', async () => {
    const { context, storeGet } = await setup({
      activitySummary: true,
      activityHeatmap: false,
      graphPreview: false,
      recent: false,
      stats: false,
      topLinked: false,
    })

    expect(storeGet).toHaveBeenCalledWith('notes.dashboard.widgets')
    expect(context.dashboardWidgets.value).toEqual({
      activityHeatmap: false,
      graphPreview: false,
      recent: false,
      stats: false,
      topLinked: false,
    })
    expect(
      Object.hasOwn(context.dashboardWidgets.value, 'activitySummary'),
    ).toBe(false)
    expect(context.hasVisibleWidgets.value).toBe(false)
  })

  it('refreshes dashboard data on every enter even when cached data already exists', async () => {
    const { context, getDashboard } = await setup()

    context.dashboardData.value = {
      activity: {} as any,
      graphPreview: {
        edges: [],
        nodes: [],
      },
      recent: [],
      stats: {} as any,
      topLinked: [],
    }

    getDashboard.mockResolvedValue({
      data: {
        activity: { updatedToday: 3 },
        graphPreview: {
          edges: [],
          nodes: [],
        },
        recent: [],
        stats: { notesCount: 12 },
        topLinked: [],
      },
    })

    await context.enterNotesDashboard()

    expect(getDashboard).toHaveBeenCalledTimes(1)
    expect(context.dashboardData.value).toMatchObject({
      activity: { updatedToday: 3 },
      stats: { notesCount: 12 },
    })
  })
})
