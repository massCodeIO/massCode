import MarkdownIt from 'markdown-it'

const markdown = new MarkdownIt({ html: false, breaks: true, linkify: false })

// Responses must never fetch remote images or interpret model-generated HTML.
markdown.disable('image')
markdown.validateLink = url => /^https?:\/\//i.test(url)

export function renderMarkdown(content: string) {
  return markdown.render(content)
}
