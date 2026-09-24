import MarkdownIt from 'markdown-it'

const markdown = new MarkdownIt({ html: false })

/** Match the exporter's fence parsing, including tilde and nested fences. */
export function getMermaidSources(content: string): string[] {
  return [
    ...new Set(
      markdown
        .parse(content, {})
        .filter(
          token =>
            token.type === 'fence'
            && token.info.trim().toLowerCase() === 'mermaid',
        )
        .map(token => token.content.trim()),
    ),
  ]
}
