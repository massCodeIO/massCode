import { Elysia } from 'elysia'
import { expect, it, vi } from 'vitest'
import system from '../system'

const context = vi.hoisted(() => ({
  preview: vi.fn(),
}))
vi.mock('../../../storage/providers/markdown', () => ({
  resetRuntimeCache: vi.fn(),
}))
vi.mock('../../../storage/providers/markdown/runtime', () => ({
  getVaultPath: () => '/test',
}))
vi.mock('../../../storage/providers/markdown/doctor', () => ({
  applyVaultDoctor: vi.fn(),
  previewVaultDoctorAsync: context.preview,
}))

it('awaits a yielded audit before validating and returning its report', async () => {
  const report = {
    conflictGroups: [],
    items: [],
    warnings: [],
    summary: {
      affectedFiles: 0,
      blocked: 0,
      conflicts: 0,
      folders: 0,
      httpEnvironments: 0,
      httpRequests: 0,
      mathSheets: 0,
      notes: 0,
      skipped: 0,
      snippets: 0,
      warnings: 0,
    },
  }
  context.preview.mockImplementation(async () => {
    await new Promise<void>(resolve => setImmediate(resolve))
    return report
  })
  const response = await new Elysia().use(system).handle(
    new Request('http://localhost/system/vault-doctor/preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ spaces: ['code'] }),
    }),
  )
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual(report)
  expect(context.preview).toHaveBeenCalledWith({ spaces: ['code'] })
})
