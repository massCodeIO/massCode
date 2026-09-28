// Structured-clone-safe HTTP transport; domain DTOs remain generated API types.
export interface ApiTransportRequest {
  url: string
  method: string
  headers: [string, string][]
  body?: ArrayBuffer
}

export interface ApiTransportResponse {
  status: number
  statusText: string
  headers: [string, string][]
  body: ArrayBuffer
}
