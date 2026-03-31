export type InternalLinkType = 'snippet' | 'note'

export interface InternalLink {
  type: InternalLinkType
  id: number
  label: string
  raw: string
}

export interface InternalLinkMatch extends InternalLink {
  from: number
  to: number
}

const ESCAPABLE_LABEL_CHARACTERS = new Set(['\\', '|', ']'])

export function escapeLabel(label: string): string {
  let result = ''

  for (const char of label) {
    if (ESCAPABLE_LABEL_CHARACTERS.has(char)) {
      result += `\\${char}`
    }
    else {
      result += char
    }
  }

  return result
}

function unescapeLabel(label: string): string {
  let result = ''

  for (let index = 0; index < label.length; index++) {
    const char = label[index]
    const nextChar = label[index + 1]

    if (char === '\\' && nextChar && ESCAPABLE_LABEL_CHARACTERS.has(nextChar)) {
      result += nextChar
      index++
      continue
    }

    result += char
  }

  return result
}

function parseLinkAt(text: string, from: number): InternalLinkMatch | null {
  if (text.slice(from, from + 2) !== '[[') {
    return null
  }

  let index = from + 2
  let type = ''

  while (index < text.length) {
    const char = text[index]
    if (char === ':') {
      break
    }

    type += char
    index++
  }

  if ((type !== 'snippet' && type !== 'note') || text[index] !== ':') {
    return null
  }

  index += 1

  let idText = ''
  while (index < text.length) {
    const char = text[index]
    if (char === '|') {
      break
    }

    if (char < '0' || char > '9') {
      return null
    }

    idText += char
    index++
  }

  const id = Number(idText)
  if (!idText || !Number.isInteger(id) || id <= 0 || text[index] !== '|') {
    return null
  }

  index += 1

  let rawLabel = ''
  while (index < text.length) {
    const char = text[index]

    if (char === '\\' && index + 1 < text.length) {
      rawLabel += char
      rawLabel += text[index + 1]
      index += 2
      continue
    }

    if (char === ']' && text[index + 1] === ']') {
      const to = index + 2
      if (!rawLabel) {
        return null
      }

      const raw = text.slice(from, to)

      return {
        from,
        id,
        label: unescapeLabel(rawLabel),
        raw,
        to,
        type,
      }
    }

    rawLabel += char
    index++
  }

  return null
}

export function parseInternalLink(text: string): InternalLink | null {
  const match = parseLinkAt(text, 0)

  if (!match || match.to !== text.length) {
    return null
  }

  return {
    id: match.id,
    label: match.label,
    raw: match.raw,
    type: match.type,
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

export function buildLinkMarkdown(
  type: InternalLinkType,
  id: number,
  label: string,
): string {
  return `[[${type}:${id}|${escapeLabel(label)}]]`
}
