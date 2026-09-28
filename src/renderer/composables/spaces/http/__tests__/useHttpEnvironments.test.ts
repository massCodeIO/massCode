import { beforeEach, expect, it, vi } from 'vitest'
import { computed, ref, shallowRef, watch } from 'vue'

const { endpoints, sonner } = vi.hoisted(() => ({
  endpoints: {
    getHttpEnvironments: vi.fn(),
    postHttpEnvironments: vi.fn(),
    patchHttpEnvironmentsById: vi.fn(),
    deleteHttpEnvironmentsById: vi.fn(),
    postHttpEnvironmentsActive: vi.fn(),
  },
  sonner: vi.fn(),
}))
vi.mock('@/services/api', () => ({ api: { httpEnvironments: endpoints } }))
vi.mock('@/electron', () => ({ i18n: { t: (key: string) => key } }))
vi.mock('@/composables/useSonner', () => ({ useSonner: () => ({ sonner }) }))
vi.mock('@/composables/useStorageMutation', () => ({
  markPersistedStorageMutation: vi.fn(),
}))
vi.mock('../useHttpSession', () => ({
  useHttpSession: () => ({
    maskedSessionVariables: { value: {} },
    resetHttpSessionNames: vi.fn(),
  }),
}))
Object.assign(globalThis, { computed, ref, shallowRef, watch })
const { useHttpEnvironments } = await import('../useHttpEnvironments')
const state = useHttpEnvironments()

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  state.resetHttpEnvironmentsState()
  endpoints.getHttpEnvironments.mockResolvedValue({
    data: { items: [], activeId: null },
  })
})

it('retains an inline save failure until the same environment saves successfully', async () => {
  endpoints.patchHttpEnvironmentsById.mockRejectedValueOnce(
    new Error('write failed'),
  )
  await state.updateHttpEnvironment(7, { name: 'QA' })
  expect(state.environmentSaveErrorId.value).toBe(7)
  expect(sonner).not.toHaveBeenCalled()
  await state.updateHttpEnvironment(8, { name: 'Other' })
  expect(state.environmentSaveErrorId.value).toBe(7)
  await state.updateHttpEnvironment(7, { name: 'QA' })
  expect(state.environmentSaveErrorId.value).toBeNull()
})

it('reports a failed creation with a stable notification identity', async () => {
  endpoints.postHttpEnvironments.mockRejectedValue(new Error('write failed'))
  await state.createHttpEnvironment({ name: 'QA' })
  expect(sonner).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'http-environment-create', type: 'error' }),
  )
})

it('does not duplicate the API cloud warning', async () => {
  endpoints.postHttpEnvironments.mockRejectedValue({
    response: { status: 503 },
  })
  await state.createHttpEnvironment({ name: 'QA' })
  expect(sonner).not.toHaveBeenCalled()
})

it('keeps the active environment when switching fails', async () => {
  state.activeEnvironmentId.value = 7
  endpoints.postHttpEnvironmentsActive.mockRejectedValue(
    new Error('write failed'),
  )
  await state.setActiveHttpEnvironment(8)
  expect(state.activeEnvironmentId.value).toBe(7)
  expect(sonner).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'http-environment-activate' }),
  )
})
