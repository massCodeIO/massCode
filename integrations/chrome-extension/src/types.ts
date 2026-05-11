export type CaptureTarget = 'code' | 'notes' | 'http'

export interface ExtensionSettings {
  apiPort: number
  apiToken: string
  defaultTarget: CaptureTarget
}

export interface PageCapturePayload {
  pageTitle: string
  selectedText: string
  url: string
}

export interface CaptureRequest {
  target: CaptureTarget
  name?: string
  text?: string
  url?: string
  pageTitle?: string
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
