import type { AiVaultItem } from '~/shared/ai'
import MarkdownIt from 'markdown-it'

const markdown = new MarkdownIt({ html: false, breaks: true, linkify: false })

// Responses must never fetch remote images or interpret model-generated HTML.
markdown.disable('image')
markdown.validateLink = url => /^https?:\/\//i.test(url)

export function renderMarkdown(content: string) {
  return markdown.render(content)
}

export function renderMarkdownBlocks(
  content: string,
  items: AiVaultItem[] = [],
  unlinkedNames: string[] = [],
) {
  const references: AiVaultItem[] = []
  const names = new Map<string, AiVaultItem | null>()
  for (const item of items) {
    const previous = names.get(item.name)
    if (!names.has(item.name)) {
      names.set(item.name, item)
    }
    else if (
      !previous
      || previous.type !== item.type
      || previous.id !== item.id
    ) {
      names.set(item.name, null)
    }
  }
  const unlinked = new Set(unlinkedNames)
  for (const name of unlinked) names.set(name, null)
  const candidates = [...names.entries()]
    .filter(([name, item]) => name && (item || unlinked.has(name)))
    .sort(([a], [b]) => b.length - a.length)
  const pattern = candidates.length
    ? new RegExp(
      candidates
        .map(([name]) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|'),
      'gu',
    )
    : undefined
  const linked = new Set<string>()
  const reference = (item: AiVaultItem) => {
    const key = `${item.type}:${item.id}`
    if (linked.has(key))
      return markdown.utils.escapeHtml(item.name)
    linked.add(key)
    const index = references.push(item) - 1
    return `<span data-ai-reference="${index}"></span>`
  }
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
  const renderText = renderer.rules.text!
  const renderCode = renderer.rules.code_inline!
  let insideLink = false
  renderer.rules.link_open = (items, index, options) => {
    insideLink = true
    return renderer.renderToken(items, index, options)
  }
  renderer.rules.link_close = (items, index, options) => {
    insideLink = false
    return renderer.renderToken(items, index, options)
  }
  renderer.rules.text = (tokens, index, options, env, self) => {
    const text = tokens[index]!.content
    if (!pattern || insideLink)
      return renderText(tokens, index, options, env, self)
    let html = ''
    let offset = 0
    for (const match of text.matchAll(pattern)) {
      const start = match.index!
      const end = start + match[0].length
      if (
        (start && /[\p{L}\p{N}_]/u.test(text[start - 1]!))
        || (end < text.length && /[\p{L}\p{N}_]/u.test(text[end]!))
      ) {
        continue
      }
      html
        += markdown.utils.escapeHtml(text.slice(offset, start))
          + (names.get(match[0])
            ? reference(names.get(match[0])!)
            : markdown.utils.escapeHtml(match[0]))
      offset = end
    }
    return html + markdown.utils.escapeHtml(text.slice(offset))
  }
  renderer.rules.code_inline = (tokens, index, options, env, self) => {
    const item = names.get(tokens[index]!.content)
    return item && !insideLink
      ? reference(item)
      : renderCode(tokens, index, options, env, self)
  }
  const html = renderer.render(tokens, markdown.options, {})
  return { html, blocks, references }
}
