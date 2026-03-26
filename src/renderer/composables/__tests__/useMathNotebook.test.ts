import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

const invoke = vi.fn()

globalThis.ref = ref
globalThis.computed = computed

vi.mock('@/electron', () => ({
  i18n: {
    t: (key: string) => key,
  },
  ipc: {
    invoke,
  },
}))

vi.mock('@/composables/useStorageMutation', () => ({
  markPersistedStorageMutation: vi.fn(),
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
})
