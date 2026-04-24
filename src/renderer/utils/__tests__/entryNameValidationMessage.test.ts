import { getEntryNameValidationMessage } from '../entryNameValidationMessage'

describe('getEntryNameValidationMessage', () => {
  const t = (key: string, params?: Record<string, unknown>) => {
    if (key === 'messages:error.entryNameLeadingDot') {
      return 'leading dot'
    }

    if (key === 'messages:error.entryNameTrailingDot') {
      return 'trailing dot'
    }

    if (key === 'messages:error.entryNameWindowsReserved') {
      return 'windows reserved'
    }

    if (key === 'messages:error.entryNameEmpty') {
      return 'empty'
    }

    if (key === 'messages:error.entryNameInvalidChars') {
      return `invalid ${(params?.chars as string) || ''}`.trim()
    }

    return key
  }

  it('returns leading dot message', () => {
    expect(getEntryNameValidationMessage('.folder', t)).toBe('leading dot')
  })

  it('returns invalid chars message with raw characters', () => {
    expect(getEntryNameValidationMessage('bad<name', t)).toBe('invalid <')
  })
})
