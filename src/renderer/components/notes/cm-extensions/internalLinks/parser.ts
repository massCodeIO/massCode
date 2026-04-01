export type InternalLinkType = 'snippet' | 'note'

export interface InternalLink {
  alias: string | null
  legacyTarget: { id: number, type: InternalLinkType } | null
  label: string
  raw: string
  target: string
}

export interface InternalLinkMatch extends InternalLink {
  from: number
  to: number
}

const ESCAPABLE_LINK_CHARACTERS = new Set(['\\', '|', ']'])

export function escapeLinkPart(value: string): string {
  let result = ''

  for (const char of value) {
    if (ESCAPABLE_LINK_CHARACTERS.has(char)) {
      result += `\\${char}`
    }
    else {
      result += char
    }
  }

  return result
}

function unescapeLinkPart(value: string): string {
  let result = ''

  for (let index = 0; index < value.length; index++) {
    const char = value[index]
    const nextChar = value[index + 1]

    if (char === '\\' && nextChar && ESCAPABLE_LINK_CHARACTERS.has(nextChar)) {
      result += nextChar
      index++
      continue
    }

    result += char
  }

  return result
}

function readLinkPart(
  text: string,
  index: number,
): { value: string, nextIndex: number, separator: 'pipe' | 'end' | 'eof' } {
  let rawValue = ''

  while (index < text.length) {
    const char = text[index]

    if (char === '\n' || char === '\r') {
      return {
        nextIndex: index,
        separator: 'eof',
        value: rawValue,
      }
    }

    if (char === '\\' && index + 1 < text.length) {
      rawValue += char
      rawValue += text[index + 1]
      index += 2
      continue
    }

    if (char === '|') {
      return {
        nextIndex: index + 1,
        separator: 'pipe',
        value: rawValue,
      }
    }

    if (char === ']' && text[index + 1] === ']') {
      return {
        nextIndex: index + 2,
        separator: 'end',
        value: rawValue,
      }
    }

    rawValue += char
    index++
  }

  return {
    nextIndex: index,
    separator: 'eof',
    value: rawValue,
  }
}

function parseLinkAt(text: string, from: number): InternalLinkMatch | null {
  if (text.slice(from, from + 2) !== '[[') {
    return null
  }

  const targetResult = readLinkPart(text, from + 2)
  if (targetResult.separator === 'eof') {
    return null
  }

  const target = unescapeLinkPart(targetResult.value)
  if (!target) {
    return null
  }

  let alias: string | null = null
  let to = targetResult.nextIndex

  if (targetResult.separator === 'pipe') {
    const aliasResult = readLinkPart(text, targetResult.nextIndex)
    if (aliasResult.separator !== 'end') {
      return null
    }

    alias = unescapeLinkPart(aliasResult.value)
    if (!alias) {
      return null
    }

    to = aliasResult.nextIndex
  }

  const raw = text.slice(from, to)
  const legacyMatch = target.match(/^(snippet|note):(\d+)$/)
  const legacyTarget = legacyMatch
    ? {
        id: Number(legacyMatch[2]),
        type: legacyMatch[1] as InternalLinkType,
      }
    : null

  return {
    alias,
    from,
    legacyTarget,
    label: alias ?? target,
    raw,
    target,
    to,
  }
}

export function parseInternalLink(text: string): InternalLink | null {
  const match = parseLinkAt(text, 0)

  if (!match || match.to !== text.length) {
    return null
  }

  return {
    alias: match.alias,
    legacyTarget: match.legacyTarget,
    label: match.label,
    raw: match.raw,
    target: match.target,
  }
}

export function findInternalLinks(text: string): InternalLinkMatch[] {
  const links: InternalLinkMatch[] = []

  for (let index = 0; index < text.length - 1; index++) {
    if (text[index] !== '[' || text[index + 1] !== '[') {
      continue
    }

    const match = parseLinkAt(text, index)
    if (!match) {
      continue
    }

    links.push(match)
    index = match.to - 1
  }

  return links
}

export function buildLinkMarkdown(target: string, label?: string): string {
  const escapedTarget = escapeLinkPart(target)

  if (!label || label === target) {
    return `[[${escapedTarget}]]`
  }

  return `[[${escapedTarget}|${escapeLinkPart(label)}]]`
}
