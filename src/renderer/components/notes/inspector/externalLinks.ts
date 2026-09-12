import { GFM, parser } from '@lezer/markdown'
import { findInternalLinks } from '~/shared/notes/internalLinks'

export interface ExternalLinkMatch {
  from: number
  to: number
  cursor: number
  raw: string
  url: string
  alias: string | null
}
const markdownParser = parser.configure(GFM)

export function findExternalLinks(content: string): ExternalLinkMatch[] {
  const tree = markdownParser.parse(content)
  const internal = findInternalLinks(content)
  const references = new Map<string, string>()
  const normalize = (label: string) =>
    label.slice(1, -1).trim().replace(/\s+/g, ' ').toLowerCase()
  tree.iterate({
    enter(node) {
      if (node.name === 'LinkReference') {
        const label = node.node.getChild('LinkLabel')
        const url = node.node.getChild('URL')
        if (label && url) {
          const key = normalize(content.slice(label.from, label.to))
          if (!references.has(key))
            references.set(key, content.slice(url.from, url.to))
        }
        return false
      }
    },
  })
  const matches: ExternalLinkMatch[] = []
  tree.iterate({
    enter(node) {
      if (
        [
          'FencedCode',
          'CodeBlock',
          'InlineCode',
          'Image',
          'LinkReference',
          'HTMLBlock',
          'HTMLTag',
        ].includes(node.name)
      ) {
        return false
      }
      if (internal.some(link => node.from >= link.from && node.to <= link.to))
        return false
      if (!['Link', 'Autolink', 'URL'].includes(node.name))
        return
      const raw = content.slice(node.from, node.to)
      const urlNode = node.node.getChild('URL')
      const marks = node.node.getChildren('LinkMark')
      const labelEnd = marks[1]?.from
      const alias
        = node.name === 'Link' && labelEnd !== undefined
          ? content.slice(node.from + 1, labelEnd)
          : null
      const reference = node.node.getChild('LinkLabel')
      let url
        = node.name === 'URL'
          ? raw
          : urlNode
            ? content.slice(urlNode.from, urlNode.to)
            : references.get(
                reference
                  ? normalize(content.slice(reference.from, reference.to))
                  : (alias ?? '').trim().replace(/\s+/g, ' ').toLowerCase(),
              )
      if (!url)
        return false
      url = url
        .replace(/^<|>$/g, '')
        .replace(/\\([\\()[\]])/g, '$1')
        .replace(/&amp;/g, '&')
      try {
        if (!['http:', 'https:'].includes(new URL(url).protocol))
          return false
      }
      catch {
        return false
      }
      matches.push({
        from: node.from,
        to: node.to,
        cursor: labelEnd ?? Math.max(node.from, node.to - 1),
        raw,
        url,
        alias,
      })
      return false
    },
  })
  return matches
}
