export type CaptureTarget = 'code' | 'notes' | 'http'

export interface ExtensionSettings {
  apiPort: number
  apiToken: string
  defaultTarget: CaptureTarget
}

export interface PageCapturePayload {
  contextLabel?: string
  faviconUrl?: string
  pageMarkdown?: string
  pageTitle: string
  pageText?: string
  selectedMarkdown?: string
  selectedText: string
  sourceTitle: string
  sourceUrl: string
  suggestedName?: string
  url: string
}

export interface CaptureRequest {
  target: CaptureTarget
  contextLabel?: string
  markdown?: string
  name?: string
  text?: string
  url?: string
  pageTitle?: string
  suggestedName?: string
  sourceTitle?: string
  sourceUrl?: string
  language?: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  source?: {
    title?: string
    url?: string
    capturedAt?: number
  }
}

export interface CaptureResponse {
  target: CaptureTarget
  id: number
}
