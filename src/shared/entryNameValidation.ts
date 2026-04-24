export type EntryNameValidationIssue =
  | { code: 'empty' }
  | { code: 'leadingDot' }
  | { code: 'invalidChars', chars: string[] }
  | { code: 'trailingDot' }
  | { code: 'windowsReserved' }

const INVALID_ENTRY_NAME_CHARS = new Set([
  '#',
  '<',
  '>',
  ':',
  '"',
  '/',
  '\\',
  '[',
  ']',
  '^',
  '|',
  '?',
  '*',
])

const WINDOWS_RESERVED_NAME_RE
  = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i

function normalizeEntryName(name: string): string {
  return name.trim()
}

export function findInvalidEntryNameChars(name: string): string[] {
  const chars: string[] = []
  const seen = new Set<string>()

  for (const char of name) {
    const isInvalid
      = INVALID_ENTRY_NAME_CHARS.has(char) || char.charCodeAt(0) <= 0x1F

    if (!isInvalid || seen.has(char)) {
      continue
    }

    seen.add(char)
    chars.push(char)
  }

  return chars
}

export function formatEntryNameValidationChars(chars: string[]): string {
  return chars
    .map((char) => {
      if (char.charCodeAt(0) <= 0x1F) {
        return `U+${char.charCodeAt(0).toString(16).padStart(4, '0').toUpperCase()}`
      }

      return char
    })
    .join(' ')
}

export function getEntryNameValidationIssue(
  name: string,
): EntryNameValidationIssue | null {
  const normalizedName = normalizeEntryName(name)

  if (!normalizedName || normalizedName === '.' || normalizedName === '..') {
    return { code: 'empty' }
  }

  if (normalizedName.startsWith('.')) {
    return { code: 'leadingDot' }
  }

  const invalidChars = findInvalidEntryNameChars(normalizedName)

  if (invalidChars.length) {
    return {
      code: 'invalidChars',
      chars: invalidChars,
    }
  }

  if (normalizedName.endsWith('.')) {
    return { code: 'trailingDot' }
  }

  if (WINDOWS_RESERVED_NAME_RE.test(normalizedName)) {
    return { code: 'windowsReserved' }
  }

  return null
}
