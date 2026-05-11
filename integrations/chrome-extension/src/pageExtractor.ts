import type { PageCapturePayload } from './types'
import Defuddle, { createMarkdownContent } from 'defuddle/full'

declare global {
  // eslint-disable-next-line vars-on-top, no-var
  var massCodePageExtractor: PageExtractorModule | undefined
}

interface PageExtractorModule {
  getPageCaptureFromPage: () => PageCapturePayload
}

export function getPageCaptureFromPage(): PageCapturePayload {
  const contextLabel = getContextLabel()
  const selectedText = getSelectedText()
  const selectedHtml = contextLabel ? '' : getSelectedHtml()
  const extracted = getExtractedPage()
  const pageTitle = extracted.title || document.title
  const selectedMarkdown = selectedHtml
    ? normalizeMarkdown(
        createMarkdownContent(selectedHtml, window.location.href),
      )
    : undefined

  return {
    contextLabel,
    pageMarkdown: contextLabel ? undefined : extracted.markdown,
    pageText: extracted.text,
    pageTitle,
    selectedMarkdown,
    selectedText,
    sourceTitle: pageTitle,
    sourceUrl: window.location.href,
    suggestedName: contextLabel,
    url: window.location.href,
  }
}

function getSelectedText(): string {
  return window.getSelection()?.toString().trim() ?? ''
}

function getSelectedHtml(): string {
  const selection = window.getSelection()

  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return ''
  }

  const container = document.createElement('div')
  for (let index = 0; index < selection.rangeCount; index += 1) {
    container.append(selection.getRangeAt(index).cloneContents())
  }

  return container.innerHTML.trim()
}

function getElementText(
  selector: string,
  root: ParentNode,
): string | undefined {
  return root.querySelector(selector)?.textContent?.trim() || undefined
}

function getContextLabel(): string | undefined {
  const selection = window.getSelection()
  const node = selection?.anchorNode
  const element = node instanceof Element ? node : node?.parentElement
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

function getExtractedPage(): {
  markdown?: string
  text?: string
  title?: string
} {
  try {
    const result = new Defuddle(document, {
      includeReplies: false,
      url: window.location.href,
    }).parse()
    const markdown = normalizeMarkdown(
      createMarkdownContent(result.content, window.location.href),
    )

    return {
      markdown: markdown || undefined,
      text: getHtmlText(result.content),
      title: result.title || undefined,
    }
  }
  catch {
    return {
      title: document.title,
    }
  }
}

function getHtmlText(html: string): string | undefined {
  const parsed = new DOMParser().parseFromString(html, 'text/html')

  return parsed.body.textContent?.replace(/\s+/g, ' ').trim() || undefined
}

function normalizeMarkdown(value: string): string {
  return value
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

globalThis.massCodePageExtractor = {
  getPageCaptureFromPage,
}
