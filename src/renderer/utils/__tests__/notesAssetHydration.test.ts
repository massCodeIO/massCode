import { describe, expect, it, vi } from 'vitest'
import { retryNotesAssetImages } from '../notesAssetHydration'

function createImage(source: string) {
  let currentSource = source

  return {
    getAttribute: vi.fn(() => currentSource),
    setAttribute: vi.fn((name: string, value: string) => {
      if (name === 'src') {
        currentSource = value
      }
    }),
  }
}

describe('retryNotesAssetImages', () => {
  it('cache-busts only images with the matching logical asset name', () => {
    const matching = createImage(
      'masscode://notes-asset/abcdefghijklmnop.png?hydrated=old',
    )
    const other = createImage('masscode://notes-asset/ponmlkjihgfedcba.png')
    const root = {
      querySelectorAll: vi.fn(() => [matching, other]),
    } as unknown as ParentNode

    retryNotesAssetImages(root, 'abcdefghijklmnop.png', 42)

    expect(matching.setAttribute).toHaveBeenCalledWith(
      'src',
      'masscode://notes-asset/abcdefghijklmnop.png?hydrated=42',
    )
    expect(other.setAttribute).not.toHaveBeenCalled()
  })
})
