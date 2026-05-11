import type { CaptureTarget, PageCapturePayload } from './types'
import { buildCaptureRequest, getSettings, postCapture } from './api'

const MENU_ROOT_ID = 'masscode-capture'
const MENU_TARGETS: Array<{ id: CaptureTarget, title: string }> = [
  { id: 'code', title: 'Code' },
  { id: 'notes', title: 'Note' },
  { id: 'http', title: 'HTTP Request' },
]

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      contexts: ['selection', 'page', 'link'],
      id: MENU_ROOT_ID,
      title: 'Save to massCode',
    })

    MENU_TARGETS.forEach((target) => {
      chrome.contextMenus.create({
        contexts: ['selection', 'page', 'link'],
        id: target.id,
        parentId: MENU_ROOT_ID,
        title: target.title,
      })
    })
  })
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!isCaptureTarget(info.menuItemId) || !tab?.id) {
    return
  }

  void captureFromTab(tab.id, info.menuItemId, {
    linkUrl: info.linkUrl,
    selectionText: info.selectionText,
  })
})

async function captureFromTab(
  tabId: number,
  target: CaptureTarget,
  context: { linkUrl?: string, selectionText?: string },
): Promise<void> {
  try {
    const settings = await getSettings()
    if (!settings.apiToken.trim()) {
      throw new Error('Set the massCode API token in the extension popup.')
    }

    const payload = await getPageCapture(tabId)
    const request = buildCaptureRequest(target, {
      ...payload,
      selectedText: context.selectionText?.trim() || payload.selectedText,
      url: context.linkUrl || payload.url,
    })

    const result = await postCapture(settings, request)
    await notify(
      'Saved to massCode',
      `Created ${result.target} item #${result.id}.`,
    )
  }
  catch (error) {
    await notify('massCode capture failed', getErrorMessage(error))
  }
}

async function getPageCapture(tabId: number): Promise<PageCapturePayload> {
  const [response] = await chrome.scripting.executeScript<PageCapturePayload>({
    func: () => ({
      pageTitle: document.title,
      selectedText: window.getSelection()?.toString().trim() ?? '',
      url: window.location.href,
    }),
    target: { tabId },
  })

  if (!response.result) {
    throw new Error('Could not read the active page.')
  }

  return response.result
}

async function notify(title: string, message: string): Promise<void> {
  await chrome.action.setBadgeText({
    text: title.startsWith('Saved') ? 'OK' : 'ERR',
  })
  await chrome.action.setTitle({ title: `${title}: ${message}` })

  setTimeout(() => {
    void chrome.action.setBadgeText({ text: '' })
  }, 3000)
}

function isCaptureTarget(value: string | number): value is CaptureTarget {
  return value === 'code' || value === 'notes' || value === 'http'
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}
