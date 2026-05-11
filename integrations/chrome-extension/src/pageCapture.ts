import type { PageCapturePayload } from './types'

export function getPageCaptureFromPage(): PageCapturePayload {
  function getSelectedText(): string {
    return window.getSelection()?.toString().trim() ?? ''
  }

  function getSelectionElement(): Element | null {
    const selection = window.getSelection()
    const node = selection?.anchorNode
    const element = node instanceof Element ? node : node?.parentElement

    return element ?? null
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

  const contextLabel = getContextLabel()
  const pageTitle = document.title

  return {
    contextLabel,
    pageTitle,
    selectedText: getSelectedText(),
    sourceTitle: pageTitle,
    sourceUrl: window.location.href,
    suggestedName: contextLabel,
    url: window.location.href,
  }
}
