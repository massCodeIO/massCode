import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, reactive, ref, watch } from 'vue'

const invoke = vi.fn()
const markPersistedStorageMutation = vi.fn()
const markUserEdit = vi.fn()

globalThis.ref = ref
globalThis.computed = computed
globalThis.reactive = reactive
globalThis.watch = watch

// Минимальный donations state: useMathNotebook тянет useDonations, который
// читает store.app при импорте модуля.
function createDonationsState() {
  return {
    lastActiveDay: '',
    currentStreak: 0,
    copies: { code: 0, http: 0, notes: 0, math: 0, tools: 0, drawings: 0 },
    created: { code: 0, http: 0, notes: 0, math: 0, drawings: 0 },
    sent: { http: 0 },
    lastShownCopyMilestones: {
      code: 0,
      http: 0,
      notes: 0,
      math: 0,
      tools: 0,
      drawings: 0,
    },
    lastShownCreatedMilestones: {
      code: 0,
      http: 0,
      notes: 0,
      math: 0,
      drawings: 0,
    },
    lastShownSentMilestones: { http: 0 },
  }
}

vi.mock('@/electron', () => ({
  i18n: {
    t: (key: string) => key,
  },
  ipc: {
    invoke,
  },
  store: {
    app: {
      get: () => createDonationsState(),
      set: vi.fn(),
    },
  },
}))

vi.mock('@/composables/useStorageMutation', () => ({
  markPersistedStorageMutation,
  markUserEdit,
}))

describe('useMathNotebook', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    invoke.mockResolvedValue({
      sheets: [],
      activeSheetId: null,
    })
  })

  it('loads again after reset', async () => {
    const { useMathNotebook } = await import(
      '../math-notebook/useMathNotebook'
    )
    const notebook = useMathNotebook()

    await notebook.init()
    expect(invoke).toHaveBeenCalledTimes(1)

    notebook.reset()
    await notebook.init()

    expect(invoke).toHaveBeenCalledTimes(2)
  })

  it('marks user edit when sheet content changes', async () => {
    const { useMathNotebook } = await import(
      '../math-notebook/useMathNotebook'
    )
    const notebook = useMathNotebook()

    await notebook.init()

    const sheetId = notebook.createSheet()
    notebook.updateSheet(sheetId, '1 + 1')

    expect(markUserEdit).toHaveBeenCalledTimes(1)
  })

  it('retries pending cloud read and blocks persist until state is loaded', async () => {
    vi.useFakeTimers()

    try {
      // Первый ответ: .state.yaml ещё не докачан из облака.
      invoke.mockResolvedValueOnce({
        sheets: [],
        activeSheetId: null,
        pending: true,
      })

      const { useMathNotebook } = await import(
        '../math-notebook/useMathNotebook'
      )
      const notebook = useMathNotebook()

      await notebook.init()

      // До первого успешного чтения persist запрещён: запись затёрла бы
      // облачную версию state.
      notebook.createSheet()
      expect(invoke).not.toHaveBeenCalledWith(
        'spaces:math:write',
        expect.anything(),
      )

      // После докачки ретрай отдаёт настоящий state.
      const remoteSheet = {
        id: 'remote-sheet',
        name: 'Remote',
        content: '2 + 2',
        createdAt: 1,
        updatedAt: 1,
      }
      invoke.mockResolvedValueOnce({
        sheets: [remoteSheet],
        activeSheetId: 'remote-sheet',
      })
      await vi.advanceTimersByTimeAsync(3000)

      expect(notebook.sheets.value).toEqual([remoteSheet])

      // Persist снова разрешён.
      notebook.selectSheet('remote-sheet')
      expect(invoke).toHaveBeenCalledWith(
        'spaces:math:write',
        expect.objectContaining({ activeSheetId: 'remote-sheet' }),
      )
    }
    finally {
      vi.useRealTimers()
    }
  })
})
