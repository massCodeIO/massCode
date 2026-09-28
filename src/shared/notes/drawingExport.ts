import MarkdownIt from 'markdown-it'

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
})

export function getDrawingUrlsFromMarkdown(content: string): string[] {
  const urls = new Set<string>()

  for (const token of markdown.parse(content, {})) {
    if (token.type !== 'inline') {
      continue
    }

    for (const child of token.children ?? []) {
      if (child.type !== 'image') {
        continue
      }

      const source = child.attrGet('src')
      if (source?.startsWith('masscode://drawing/')) {
        urls.add(source)
      }
    }
  }

  return [...urls]
}
