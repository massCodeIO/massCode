import MarkdownIt from 'markdown-it'

const markdown = new MarkdownIt({ html: false, breaks: true, linkify: false })

// Responses must never fetch remote images or interpret model-generated HTML.
markdown.disable('image')
markdown.validateLink = url => /^https?:\/\//i.test(url)

export function renderMarkdown(content: string) {
  return markdown.render(content)
}

export function renderMarkdownBlocks(content: string) {
  const blocks: { code: string, language: string }[] = []
  const tokens = markdown.parse(content, {})
  // Renderer rules run at any nesting depth, including lists and blockquotes.
  const renderer = new MarkdownIt({ html: false, breaks: true, linkify: false })
    .renderer
  renderer.rules.fence = renderer.rules.code_block = (items, index) => {
    const token = items[index]!
    const id
      = blocks.push({
        code: token.content,
        language: token.info.trim().split(/\s+/)[0] ?? '',
      }) - 1
    return `<div data-ai-code="${id}"></div>`
  }
  return { html: renderer.render(tokens, markdown.options, {}), blocks }
}
