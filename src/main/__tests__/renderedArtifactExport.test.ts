import { beforeEach, expect, it, vi } from 'vitest'
import {
  exportRenderedArtifact,
  parseRenderedArtifact,
} from '../renderedArtifactExport'

const fixture = vi.hoisted(() => ({
  vault: '/fixture',
  save: vi.fn(),
  write: vi.fn(),
}))
vi.mock('electron', () => ({
  BrowserWindow: { getFocusedWindow: () => null },
  dialog: { showSaveDialog: fixture.save },
}))
vi.mock('../storage/providers/markdown/runtime', () => ({
  getVaultPath: () => fixture.vault,
}))
vi.mock('../notesExport', () => ({
  sanitizeNoteExportFileName: (name: string) => `${name}.html`,
  writeFileAtomically: fixture.write,
}))
const payload = {
  format: 'html',
  name: 'Report',
  data: '<html>Exact result</html>',
  vault: '/fixture',
}
beforeEach(() => {
  vi.resetAllMocks()
  fixture.vault = '/fixture'
})

it('returns saved only after the actual atomic write finishes', async () => {
  fixture.save.mockResolvedValue({
    canceled: false,
    filePath: '/chosen/report.html',
  })
  let finish!: () => void
  fixture.write.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  let completed = false
  const result = exportRenderedArtifact(payload).then((value) => {
    completed = true
    return value
  })
  await vi.waitFor(() => expect(fixture.write).toHaveBeenCalledOnce())
  expect(completed).toBe(false)
  expect(fixture.write.mock.calls[0]![0]).toBe('/chosen/report.html')
  expect(fixture.write.mock.calls[0]![1].toString('utf8')).toBe(payload.data)
  finish()
  await expect(result).resolves.toMatchObject({
    status: 'saved',
    filePath: '/chosen/report.html',
    bytes: 25,
  })
})

it('does not write on cancelled dialog or changed vault', async () => {
  fixture.save.mockResolvedValueOnce({ canceled: true })
  await expect(exportRenderedArtifact(payload)).resolves.toEqual({
    status: 'cancelled',
  })
  fixture.save.mockImplementationOnce(async () => {
    fixture.vault = '/other'
    return { canceled: false, filePath: '/chosen/report.html' }
  })
  await expect(exportRenderedArtifact(payload)).resolves.toEqual({
    status: 'stale',
  })
  await expect(exportRenderedArtifact(payload)).resolves.toEqual({
    status: 'stale',
  })
  expect(fixture.write).not.toHaveBeenCalled()
  expect(fixture.save).toHaveBeenCalledTimes(2)
})

it('propagates a failed write instead of a saved receipt', async () => {
  fixture.save.mockResolvedValue({
    canceled: false,
    filePath: '/chosen/report.html',
  })
  fixture.write.mockRejectedValue(new Error('write denied'))
  await expect(exportRenderedArtifact(payload)).rejects.toThrow('write denied')
})

it('validates the image format and decodes actual dom-to-image SVG output', () => {
  const svg
    = '<svg><foreignObject width="100%"><div>50% %23tag%0Anext</div></foreignObject></svg>'
  expect(
    parseRenderedArtifact({
      ...payload,
      format: 'svg',
      data: `data:image/svg+xml;charset=utf-8,${svg}`,
    }).bytes.toString(),
  ).toContain('50% #tag\nnext')
  expect(() =>
    parseRenderedArtifact({
      ...payload,
      format: 'png',
      data: 'data:image/png;base64,aHRtbA==',
    }),
  ).toThrow('INVALID_ARTIFACT')
  expect(() =>
    parseRenderedArtifact({
      ...payload,
      format: 'svg',
      data: 'https://external.example/svg',
    }),
  ).toThrow('INVALID_ARTIFACT')
  expect(() => parseRenderedArtifact({ ...payload, format: 'exe' })).toThrow(
    'INVALID_ARTIFACT',
  )
})
