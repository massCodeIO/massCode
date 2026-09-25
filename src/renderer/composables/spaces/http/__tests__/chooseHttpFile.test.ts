import type { HttpRequestDraft } from '../useHttpRequests'
import { beforeEach, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({ vault: '/vault', invoke: vi.fn() }))
vi.mock('@/electron', () => ({
  ipc: { invoke: mock.invoke },
  store: { preferences: { get: () => mock.vault } },
}))
const { chooseHttpFile } = await import('../chooseHttpFile')
function draft() {
  return ({
    bodyType: 'binary',
    body: null,
    formData: [],
  }) as unknown as HttpRequestDraft
}
beforeEach(() => {
  mock.vault = '/vault'
  mock.invoke.mockReset().mockResolvedValue('/private/file.bin')
})
it('changes only the draft and returns no file path', async () => {
  const request = draft()
  expect(await chooseHttpFile(request, undefined, () => true)).toEqual({
    status: 'done',
    persisted: false,
  })
  expect(request.body).toBe('/private/file.bin')
  expect(mock.invoke).toHaveBeenCalledOnce()
})
it('honors cancellation and guards draft, vault and request across the picker await', async () => {
  mock.invoke.mockResolvedValueOnce(null)
  expect(await chooseHttpFile(draft(), undefined, () => true)).toEqual({
    status: 'cancelled',
  })
  for (const change of ['vault', 'draft', 'request']) {
    const request = draft()
    let current = true
    mock.vault = '/vault'
    mock.invoke.mockImplementationOnce(async () => {
      if (change === 'vault')
        mock.vault = '/other'
      if (change === 'draft')
        request.body = 'manual'
      if (change === 'request')
        current = false
      return '/private/file.bin'
    })
    expect(await chooseHttpFile(request, undefined, () => current)).toEqual({
      status: 'stale',
    })
    expect(request.body).not.toBe('/private/file.bin')
  }
})
it('changes the exact multipart row even when names are duplicated', async () => {
  const request = draft()
  request.bodyType = 'multipart'
  request.formData = [
    { key: 'file', type: 'file', value: '' },
    { key: 'file', type: 'file', value: '' },
  ]
  expect(
    await chooseHttpFile(request, request.formData[1], () => true),
  ).toMatchObject({ status: 'done' })
  expect(request.formData.map(entry => entry.value)).toEqual([
    '',
    '/private/file.bin',
  ])
})
