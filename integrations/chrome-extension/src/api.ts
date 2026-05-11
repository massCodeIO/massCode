import type {
  CaptureRequest,
  CaptureResponse,
  CaptureTarget,
  ExtensionSettings,
  PageCapturePayload,
} from './types'

const DEFAULT_SETTINGS: ExtensionSettings = {
  apiPort: 4321,
  apiToken: '',
  defaultTarget: 'notes',
}

export async function getSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.local.get(DEFAULT_SETTINGS)

  return {
    apiPort: Number(stored.apiPort) || DEFAULT_SETTINGS.apiPort,
    apiToken:
      typeof stored.apiToken === 'string'
        ? stored.apiToken
        : DEFAULT_SETTINGS.apiToken,
    defaultTarget: isCaptureTarget(stored.defaultTarget)
      ? stored.defaultTarget
      : DEFAULT_SETTINGS.defaultTarget,
  }
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.local.set(settings)
}

export function buildCaptureRequest(
  target: CaptureTarget,
  payload: PageCapturePayload,
): CaptureRequest {
  const selectedText = payload.selectedText.trim()

  if (target === 'http') {
    const url = findFirstUrl(selectedText) ?? payload.url

    return {
      contextLabel: payload.contextLabel,
      method: 'GET',
      pageTitle: payload.pageTitle,
      sourceTitle: payload.sourceTitle,
      sourceUrl: payload.sourceUrl,
      source: {
        capturedAt: Date.now(),
        title: payload.sourceTitle,
        url: payload.sourceUrl,
      },
      suggestedName: getHttpSuggestedName(url),
      target,
      url,
    }
  }

  return {
    contextLabel: payload.contextLabel,
    language: target === 'code' ? 'plain_text' : undefined,
    pageTitle: payload.pageTitle,
    sourceTitle: payload.sourceTitle,
    sourceUrl: payload.sourceUrl,
    source: {
      capturedAt: Date.now(),
      title: payload.sourceTitle,
      url: payload.sourceUrl,
    },
    suggestedName: payload.suggestedName ?? payload.contextLabel,
    target,
    text: selectedText,
    url: payload.url,
  }
}

export async function postCapture(
  settings: ExtensionSettings,
  request: CaptureRequest,
): Promise<CaptureResponse> {
  const response = await fetch(
    `http://localhost:${settings.apiPort}/captures/`,
    {
      body: JSON.stringify(request),
      headers: {
        'Authorization': `Bearer ${settings.apiToken}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
  )

  if (!response.ok) {
    throw new Error(await getErrorMessage(response))
  }

  return (await response.json()) as CaptureResponse
}

export function isCaptureTarget(value: unknown): value is CaptureTarget {
  return value === 'code' || value === 'notes' || value === 'http'
}

function findFirstUrl(text: string): string | undefined {
  return text.match(/https?:\/\/\S+/)?.[0]
}

function getHttpSuggestedName(url: string): string {
  try {
    const parsedUrl = new URL(url)
    const path
      = parsedUrl.pathname === '/' ? parsedUrl.hostname : parsedUrl.pathname

    return `GET ${path}`
  }
  catch {
    return 'GET request'
  }
}

async function getErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { message?: string }
    return data.message ?? `massCode API error: ${response.status}`
  }
  catch {
    return `massCode API error: ${response.status}`
  }
}
