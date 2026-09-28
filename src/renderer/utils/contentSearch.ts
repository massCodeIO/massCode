export interface ContentSearchMatch {
  from: number
  to: number
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function getContentSearchMatches(
  content: string,
  query: string,
): ContentSearchMatch[] {
  if (!query)
    return []

  const regexp = new RegExp(escapeRegExp(query), 'giu')
  return Array.from(content.matchAll(regexp), match => ({
    from: match.index,
    to: match.index + match[0].length,
  }))
}
