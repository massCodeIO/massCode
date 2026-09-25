import { beforeEach, expect, it, vi } from 'vitest'
import { saveRenderedArtifact } from '../useRenderedArtifactExport'

const fixture = vi.hoisted(() => ({
  vault: '/fixture',
  invoke: vi.fn(),
  notify: vi.fn(),
}))
vi.mock('@/electron', () => ({
  ipc: { invoke: fixture.invoke },
  store: { preferences: { get: () => fixture.vault } },
  i18n: { t: (key: string) => key },
}))
vi.mock('@/composables/useSonner', () => ({
  useSonner: () => ({ sonner: fixture.notify }),
}))
beforeEach(() => {
  vi.resetAllMocks()
  fixture.vault = '/fixture'
})

it('does not open a picker for a stale target or changed vault after rendering', async () => {
  await expect(
    saveRenderedArtifact(
      'html',
      'Old',
      async () => '<html/>',
      () => false,
    ),
  ).resolves.toEqual({ status: 'stale' })
  await expect(
    saveRenderedArtifact(
      'html',
      'Old',
      async () => {
        fixture.vault = '/other'
        return '<html/>'
      },
      () => true,
    ),
  ).resolves.toEqual({ status: 'stale' })
  expect(fixture.invoke).not.toHaveBeenCalled()
  expect(fixture.notify).not.toHaveBeenCalled()
})

it('returns actual cancellation and failure without a success notification', async () => {
  fixture.invoke
    .mockResolvedValueOnce({ status: 'cancelled' })
    .mockRejectedValueOnce(new Error('write failed'))
  await expect(
    saveRenderedArtifact(
      'html',
      'Current',
      async () => '<html/>',
      () => true,
    ),
  ).resolves.toEqual({ status: 'cancelled' })
  expect(fixture.notify).not.toHaveBeenCalled()
  await expect(
    saveRenderedArtifact(
      'html',
      'Current',
      async () => '<html/>',
      () => true,
    ),
  ).resolves.toEqual({ status: 'failed' })
  expect(fixture.notify).toHaveBeenCalledExactlyOnceWith({
    type: 'error',
    message: 'messages:error.artifactExportFailed',
  })
})
