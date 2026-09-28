import { describe, expect, it, vi } from 'vitest'

const send = vi.fn()

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => [{ webContents: { send } }],
  },
}))

describe('notes asset ready events', () => {
  it('broadcasts a targeted completion immediately', async () => {
    const { broadcastNotesAssetReady } = await import('../notesAssetEvents')
    broadcastNotesAssetReady('abcdefghijklmnop.png')

    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith(
      'system:notes-asset-ready',
      'abcdefghijklmnop.png',
    )
  })
})
