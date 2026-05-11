import type { PageCapturePayload } from './types'

interface PageExtractorModule {
  getPageCaptureFromPage: () => PageCapturePayload
}

declare global {
  // eslint-disable-next-line vars-on-top, no-var
  var massCodePageExtractor: PageExtractorModule | undefined
}

export async function getPageCaptureFromPage(): Promise<PageCapturePayload> {
  await import(chrome.runtime.getURL('pageExtractor.js'))
  const extractor = globalThis.massCodePageExtractor

  if (!extractor) {
    throw new Error('Could not initialize the page extractor.')
  }

  return extractor.getPageCaptureFromPage()
}
