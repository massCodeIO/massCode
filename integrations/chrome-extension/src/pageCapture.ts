import type { PageCapturePayload } from './types'

export function getPageCaptureFromPage(): PageCapturePayload {
  function getSelectedText(): string {
    return window.getSelection()?.toString().trim() ?? ''
  }

  function normalizeInlineText(value: string): string {
    return value.replace(/\s+/g, ' ')
  }

  function normalizeMarkdown(value: string): string {
    return value
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  function normalizeComparableText(value: string): string {
    return value.replace(/\s+/g, ' ').trim()
  }

  function getSelectionElement(): Element | null {
    const selection = window.getSelection()
    const node = selection?.anchorNode
    const element = node instanceof Element ? node : node?.parentElement

    return element ?? null
  }

  function getSelectionFragment(): DocumentFragment | null {
    const selection = window.getSelection()

    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return null
    }

    const fragment = document.createDocumentFragment()
    for (let index = 0; index < selection.rangeCount; index += 1) {
      fragment.append(selection.getRangeAt(index).cloneContents())
    }

    return fragment
  }

  function getSelectionRange(): Range | null {
    const selection = window.getSelection()

    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return null
    }

    return selection.getRangeAt(0)
  }

  function getElementText(
    selector: string,
    root: ParentNode,
  ): string | undefined {
    return root.querySelector(selector)?.textContent?.trim() || undefined
  }

  function getContextLabel(): string | undefined {
    const element = getSelectionElement()
    const fileRoot = element?.closest('.file, .gist-file, [data-path]')

    if (!fileRoot) {
      return undefined
    }

    const dataPath = fileRoot.getAttribute('data-path')?.trim()
    if (dataPath) {
      return dataPath
    }

    return (
      getElementText('.file-info a', fileRoot)
      ?? getElementText('.file-header a', fileRoot)
      ?? getElementText('[data-testid="file-name"]', fileRoot)
      ?? undefined
    )
  }

  function getChildrenMarkdown(parent: ParentNode): string {
    return Array.from(parent.childNodes).map(getNodeMarkdown).join('')
  }

  function getElementMarkdown(element: Element): string {
    return getNodeMarkdown(element)
  }

  function wrapInlineMarkdown(marker: string, parent: ParentNode): string {
    const value = getChildrenMarkdown(parent).trim()

    return value ? `${marker}${value}${marker}` : ''
  }

  function getLinkMarkdown(element: HTMLAnchorElement): string {
    const label = getChildrenMarkdown(element).trim() || element.href

    return element.href ? `[${label}](${element.href})` : label
  }

  function getListMarkdown(element: Element, ordered: boolean): string {
    return Array.from(element.children)
      .filter(child => child.tagName.toLowerCase() === 'li')
      .map((child, index) => {
        const marker = ordered ? `${index + 1}.` : '-'
        const value = getChildrenMarkdown(child).trim()

        return value ? `${marker} ${value}` : marker
      })
      .join('\n')
  }

  function getBlockquoteMarkdown(element: Element): string {
    return getChildrenMarkdown(element)
      .trim()
      .split('\n')
      .map(line => `> ${line}`)
      .join('\n')
  }

  function getTableCellMarkdown(cell: Element): string {
    return normalizeInlineText(getChildrenMarkdown(cell))
      .replace(/\|/g, '\\|')
      .trim()
  }

  function getTableMarkdown(element: Element): string {
    const rows = Array.from(element.querySelectorAll('tr'))
      .filter(row => row.closest('table') === element)
      .map(row =>
        Array.from(row.children)
          .filter((cell) => {
            const tagName = cell.tagName.toLowerCase()

            return tagName === 'td' || tagName === 'th'
          })
          .map(getTableCellMarkdown),
      )
      .filter(row => row.length > 0)

    if (rows.length === 0) {
      return ''
    }

    const columnCount = Math.max(...rows.map(row => row.length))
    const normalizeRow = (row: string[]): string[] => [
      ...row,
      ...Array.from({ length: columnCount - row.length }, () => ''),
    ]
    const header = normalizeRow(rows[0])
    const separator = Array.from({ length: columnCount }, () => '---')
    const body = rows.slice(1).map(normalizeRow)

    return [header, separator, ...body]
      .map(row => `| ${row.join(' | ')} |`)
      .join('\n')
  }

  function getNodeMarkdown(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return normalizeInlineText(node.textContent ?? '')
    }

    if (!(node instanceof Element)) {
      return ''
    }

    const tagName = node.tagName.toLowerCase()

    if (tagName === 'br') {
      return '\n'
    }

    if (/^h[1-6]$/.test(tagName)) {
      const level = Number(tagName.slice(1))
      const value = getChildrenMarkdown(node).trim()

      return value ? `${'#'.repeat(level)} ${value}\n\n` : ''
    }

    if (tagName === 'p') {
      const value = getChildrenMarkdown(node).trim()

      return value ? `${value}\n\n` : ''
    }

    if (tagName === 'strong' || tagName === 'b') {
      return wrapInlineMarkdown('**', node)
    }

    if (tagName === 'em' || tagName === 'i') {
      return wrapInlineMarkdown('*', node)
    }

    if (tagName === 'a') {
      return getLinkMarkdown(node as HTMLAnchorElement)
    }

    if (tagName === 'code' && node.parentElement?.tagName !== 'PRE') {
      const value = node.textContent?.trim()

      return value ? `\`${value}\`` : ''
    }

    if (tagName === 'pre') {
      const value = node.textContent?.trimEnd()

      return value ? `\`\`\`\n${value}\n\`\`\`\n\n` : ''
    }

    if (tagName === 'ul' || tagName === 'ol') {
      const value = getListMarkdown(node, tagName === 'ol')

      return value ? `${value}\n\n` : ''
    }

    if (tagName === 'blockquote') {
      const value = getBlockquoteMarkdown(node)

      return value ? `${value}\n\n` : ''
    }

    if (tagName === 'table') {
      const value = getTableMarkdown(node)

      return value ? `${value}\n\n` : ''
    }

    if (
      tagName === 'article'
      || tagName === 'div'
      || tagName === 'main'
      || tagName === 'section'
    ) {
      const value = getChildrenMarkdown(node).trim()

      return value ? `${value}\n\n` : ''
    }

    return getChildrenMarkdown(node)
  }

  function getSelectedMarkdown(hasCodeContext: boolean): string | undefined {
    if (hasCodeContext) {
      return undefined
    }

    const selectedText = getSelectedText()
    const fragment = getSelectionFragment()
    const fragmentMarkdown = fragment
      ? normalizeMarkdown(getChildrenMarkdown(fragment))
      : undefined
    const blockMarkdown = getSelectedBlockMarkdown()

    if (shouldUseBlockMarkdown(blockMarkdown, fragmentMarkdown, selectedText)) {
      return blockMarkdown
    }

    return fragmentMarkdown || undefined
  }

  function getSelectionRoot(range: Range): Element {
    const container = range.commonAncestorContainer
    const element
      = container instanceof Element ? container : container.parentElement

    return (
      element?.closest('article, main, section, [role="main"], .vp-doc')
      ?? document.body
    )
  }

  function getSelectedBlockMarkdown(): string | undefined {
    const range = getSelectionRange()
    if (!range) {
      return undefined
    }

    const root = getSelectionRoot(range)
    const blockSelector = 'h1,h2,h3,h4,h5,h6,p,pre,ul,ol,blockquote,table'
    const blocks = Array.from(root.querySelectorAll(blockSelector))
      .filter(block => range.intersectsNode(block))
      .filter((block, index, items) => {
        const parentBlock = block.parentElement?.closest(blockSelector)

        return !parentBlock || !items.includes(parentBlock)
      })

    if (blocks.length === 0) {
      return undefined
    }

    return (
      normalizeMarkdown(blocks.map(getElementMarkdown).join('')) || undefined
    )
  }

  function hasMarkdownStructure(value?: string): boolean {
    return Boolean(
      value && /(?:^|\n)(?:#{1,6} |- |\d+\. |> |\| )|\[[^\]]+\]\(/.test(value),
    )
  }

  function shouldUseBlockMarkdown(
    blockMarkdown: string | undefined,
    fragmentMarkdown: string | undefined,
    selectedText: string,
  ): boolean {
    if (!blockMarkdown) {
      return false
    }

    if (!fragmentMarkdown) {
      return true
    }

    if (
      hasMarkdownStructure(blockMarkdown)
      && !hasMarkdownStructure(fragmentMarkdown)
    ) {
      const blockText = normalizeComparableText(blockMarkdown)
      const text = normalizeComparableText(selectedText)

      return blockText.length <= text.length * 2
    }

    return false
  }

  const contextLabel = getContextLabel()
  const pageTitle = document.title

  return {
    contextLabel,
    pageTitle,
    selectedMarkdown: getSelectedMarkdown(Boolean(contextLabel)),
    selectedText: getSelectedText(),
    sourceTitle: pageTitle,
    sourceUrl: window.location.href,
    suggestedName: contextLabel,
    url: window.location.href,
  }
}
