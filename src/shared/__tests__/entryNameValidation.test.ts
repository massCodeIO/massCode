import {
  findInvalidEntryNameChars,
  formatEntryNameValidationChars,
  getEntryNameValidationIssue,
} from '../entryNameValidation'

describe('entryNameValidation', () => {
  it('collects unique invalid characters in input order', () => {
    expect(findInvalidEntryNameChars('bad:/name:*')).toEqual([':', '/', '*'])
  })

  it('returns invalid chars issue with collected characters', () => {
    expect(getEntryNameValidationIssue('bad:/name')).toEqual({
      code: 'invalidChars',
      chars: [':', '/'],
    })
    expect(getEntryNameValidationIssue('bad#[name]^')).toEqual({
      code: 'invalidChars',
      chars: ['#', '[', ']', '^'],
    })
  })

  it('returns empty issue for blank names', () => {
    expect(getEntryNameValidationIssue('   ')).toEqual({
      code: 'empty',
    })
  })

  it('returns trailing issue for names ending with dot', () => {
    expect(getEntryNameValidationIssue('note.')).toEqual({
      code: 'trailingDot',
    })
  })

  it('returns leading dot issue for names starting with dot', () => {
    expect(getEntryNameValidationIssue('.note')).toEqual({
      code: 'leadingDot',
    })
  })

  it('returns reserved issue for Windows reserved names', () => {
    expect(getEntryNameValidationIssue('con')).toEqual({
      code: 'windowsReserved',
    })
    expect(getEntryNameValidationIssue('LPT1.txt')).toEqual({
      code: 'windowsReserved',
    })
  })

  it('returns null for valid names', () => {
    expect(getEntryNameValidationIssue('Valid note name')).toBeNull()
  })

  it('formats control characters for tooltip display', () => {
    expect(formatEntryNameValidationChars([':', '\n'])).toBe(': U+000A')
  })
})
