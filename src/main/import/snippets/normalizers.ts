const INVALID_ENTRY_CHARS = new Set([
  '\\',
  '/',
  ':',
  '*',
  '?',
  '"',
  '<',
  '>',
  '#',
  '[',
  ']',
  '^',
  '|',
])
const WINDOWS_RESERVED_NAME_RE
  = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i

function replaceInvalidEntryChars(value: string): string {
  return [...value]
    .map((char) => {
      if (INVALID_ENTRY_CHARS.has(char) || char.charCodeAt(0) <= 0x1F) {
        return '-'
      }

      return char
    })
    .join('')
}

export function normalizeImportEntryName(
  value: unknown,
  fallback: string,
): string {
  const raw = typeof value === 'string' ? value : ''
  let name = replaceInvalidEntryChars(raw.trim())

  name = name
    .replace(/^\.+/, '')
    .replace(/[. ]+$/g, '')
    .trim()

  if (!name || name === '.' || name === '..') {
    name = fallback
  }

  if (WINDOWS_RESERVED_NAME_RE.test(name)) {
    name = `${name} item`
  }

  return name
}

export function normalizeImportTag(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value
    .trim()
    .replace(/^#+/, '')
    .replace(/[\\/]+/g, '-')
    .trim()
  return normalized || null
}

export function uniqueStrings(values: string[]): string[] {
  const result: string[] = []
  const seen = new Set<string>()

  for (const value of values) {
    const key = value.toLowerCase()
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    result.push(value)
  }

  return result
}
