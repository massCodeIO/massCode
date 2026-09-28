import { normalizeSearchValue } from './searchIndex'

// Whitespace separators keep word tokenization and Unicode case conversion
// independent across parts, while preserving the original joined text.
export type SearchText =
  | string
  | {
    parts: string[]
    separator: ' ' | '\n'
  }

export function normalizeSearchText(text: SearchText): SearchText {
  return typeof text === 'string'
    ? normalizeSearchValue(text)
    : {
        parts: text.parts.map(normalizeSearchValue),
        separator: text.separator,
      }
}

export function searchTextIncludes(text: SearchText, query: string): boolean {
  if (typeof text === 'string')
    return text.includes(query)
  if (!query)
    return true
  if (text.parts.some(part => part.includes(query)))
    return true
  if (query.length === 1)
    return text.parts.length > 1 && text.separator.includes(query)

  // Only a query-sized suffix/prefix is needed to test a join. Carry the
  // suffix across short/empty parts so a phrase can span several joins.
  const limit = query.length - 1
  let suffix = text.parts[0]?.slice(-limit) || ''
  for (let index = 1; index < text.parts.length; index++) {
    const part = text.parts[index]
    const boundary = suffix + text.separator + part.slice(0, limit)
    if (boundary.includes(query))
      return true
    suffix = part.length >= limit ? part.slice(-limit) : boundary.slice(-limit)
  }
  return false
}
