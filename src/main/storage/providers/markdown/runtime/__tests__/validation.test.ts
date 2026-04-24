import { validateEntryName } from '../validation'

describe('validateEntryName', () => {
  it('rejects names starting with dot', () => {
    expect(() => validateEntryName('.note', 'note')).toThrow(
      'INVALID_NAME:note name cannot start with a dot',
    )
    expect(() => validateEntryName('.snippet', 'snippet')).toThrow(
      'INVALID_NAME:snippet name cannot start with a dot',
    )
  })

  it('rejects names with Obsidian-reserved characters', () => {
    expect(() => validateEntryName('note#heading', 'note')).toThrow(
      'INVALID_NAME:note name contains invalid characters',
    )
    expect(() => validateEntryName('folder[name]', 'folder')).toThrow(
      'INVALID_NAME:folder name contains invalid characters',
    )
    expect(() => validateEntryName('snippet^block', 'snippet')).toThrow(
      'INVALID_NAME:snippet name contains invalid characters',
    )
  })
})
