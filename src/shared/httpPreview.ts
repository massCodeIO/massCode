import type { HarRequest } from 'httpsnippet'

export const HTTP_PREVIEW_TARGETS = [
  {
    id: 'shell',
    clients: [
      {
        id: 'curl',
        client: 'curl',
      },
      {
        id: 'shell:httpie',
        client: 'httpie',
      },
      {
        id: 'shell:wget',
        client: 'wget',
      },
    ],
  },
  {
    id: 'c',
    clients: [
      {
        id: 'c:libcurl',
        client: 'libcurl',
      },
    ],
  },
  {
    id: 'clojure',
    clients: [
      {
        id: 'clojure:clj_http',
        client: 'clj_http',
      },
    ],
  },
  {
    id: 'crystal',
    clients: [
      {
        id: 'crystal:native',
        client: 'native',
      },
    ],
  },
  {
    id: 'csharp',
    clients: [
      {
        id: 'csharp:httpclient',
        client: 'httpclient',
      },
      {
        id: 'csharp:restsharp',
        client: 'restsharp',
      },
    ],
  },
  {
    id: 'go',
    clients: [
      {
        id: 'go:native',
        client: 'native',
      },
    ],
  },
  {
    id: 'http',
    clients: [
      {
        id: 'http',
        client: 'http1.1',
      },
    ],
  },
  {
    id: 'java',
    clients: [
      {
        id: 'java:nethttp',
        client: 'nethttp',
      },
      {
        id: 'java:okhttp',
        client: 'okhttp',
      },
    ],
  },
  {
    id: 'javascript',
    clients: [
      {
        id: 'fetch',
        client: 'fetch',
      },
      {
        id: 'axios',
        client: 'axios',
      },
    ],
  },
  {
    id: 'kotlin',
    clients: [
      {
        id: 'kotlin:okhttp',
        client: 'okhttp',
      },
    ],
  },
  {
    id: 'node',
    clients: [
      {
        id: 'node:native',
        client: 'native',
      },
      {
        id: 'node:axios',
        client: 'axios',
      },
      {
        id: 'node:fetch',
        client: 'fetch',
      },
    ],
  },
  {
    id: 'objc',
    clients: [
      {
        id: 'objc:nsurlsession',
        client: 'nsurlsession',
      },
    ],
  },
  {
    id: 'ocaml',
    clients: [
      {
        id: 'ocaml:cohttp',
        client: 'cohttp',
      },
    ],
  },
  {
    id: 'php',
    clients: [
      {
        id: 'php:curl',
        client: 'curl',
      },
      {
        id: 'php:guzzle',
        client: 'guzzle',
      },
    ],
  },
  {
    id: 'powershell',
    clients: [
      {
        id: 'powershell:restmethod',
        client: 'restmethod',
      },
    ],
  },
  {
    id: 'python',
    clients: [
      {
        id: 'python:requests',
        client: 'requests',
      },
      {
        id: 'python:python3',
        client: 'python3',
      },
    ],
  },
  {
    id: 'r',
    clients: [
      {
        id: 'r:httr',
        client: 'httr',
      },
    ],
  },
  {
    id: 'ruby',
    clients: [
      {
        id: 'ruby:native',
        client: 'native',
      },
    ],
  },
  {
    id: 'rust',
    clients: [
      {
        id: 'rust:reqwest',
        client: 'reqwest',
      },
    ],
  },
  {
    id: 'swift',
    clients: [
      {
        id: 'swift:nsurlsession',
        client: 'nsurlsession',
      },
    ],
  },
] as const

export type HttpRequestPreviewFormat =
  (typeof HTTP_PREVIEW_TARGETS)[number]['clients'][number]['id']
export const HTTP_PREVIEW_FORMATS = HTTP_PREVIEW_TARGETS.flatMap(target =>
  target.clients.map(client => client.id),
)

export interface HttpSnippetPayload {
  request: HarRequest
  format: HttpRequestPreviewFormat
}
