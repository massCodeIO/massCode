import type { HttpSnippetPayload } from '../../shared/httpPreview'
import { HTTPSnippet } from 'httpsnippet'
import { HTTP_PREVIEW_TARGETS } from '../../shared/httpPreview'
import { generateNodePreview } from './nodePreview'
import { generatePythonRequestsPreview } from './pythonPreview'
import { generateSwiftPreview } from './swiftPreview'

export function generateHttpSnippet({
  request,
  format,
}: HttpSnippetPayload): string {
  const target = HTTP_PREVIEW_TARGETS.find(target =>
    target.clients.some(client => client.id === format),
  )
  const client = target?.clients.find(client => client.id === format)
  if (!target || !client)
    throw new Error('Unsupported HTTP preview format')
  if (
    format === 'node:native'
    || format === 'node:axios'
    || format === 'node:fetch'
  ) {
    return generateNodePreview(
      request,
      format === 'node:native'
        ? 'native'
        : format === 'node:axios'
          ? 'axios'
          : 'fetch',
    )
  }
  if (target.id === 'swift')
    return generateSwiftPreview(request)
  if (format === 'python:requests')
    return generatePythonRequestsPreview(request)
  if (
    request.postData.mimeType === 'multipart/form-data'
    && request.postData.params?.some(param => param.fileName)
  ) {
    throw new Error('HTTP_PREVIEW_MULTIPART_FILES_UNSUPPORTED')
  }
  if (format === 'python:python3' && /^\{\{/.test(request.url))
    throw new Error('HTTP_PREVIEW_URL_TEMPLATE_UNSUPPORTED')
  // HAR validation requires an absolute URL with a numeric port. Temporary
  // tokens exist only in the URL fields and are restored before conversion.
  let prefix = 'masscodevariable'
  while (JSON.stringify(request).includes(prefix)) prefix += 'x'
  const variables = new Map<string, string>()
  let url = request.url.replace(
    /\{\{\s*[\w.-]+\s*\}\}|%7B%7B.*?%7D%7D/gi,
    (match) => {
      const variable = match.startsWith('%')
        ? decodeURIComponent(match)
        : match
      if (!/^\{\{\s*[\w.-]+\s*\}\}$/.test(variable))
        return match
      const token = `${prefix}${variables.size}end`
      variables.set(token, variable)
      return token
    },
  )
  const baseUrlToken = [...variables.keys()].find(
    token => url.startsWith(token) && !url.startsWith(`${token}:`),
  )
  let port = 49152
  url = url.replace(
    new RegExp(`:(${prefix}\\d+end)(?=[/?#]|$)`),
    (_, token: string) => {
      while (JSON.stringify(request).includes(String(port))) port++
      variables.set(String(port), variables.get(token)!)
      variables.delete(token)
      return `:${port}`
    },
  )
  const validationUrl = baseUrlToken ? `https://${url}` : url
  const restore = (value: string) => {
    if (baseUrlToken)
      value = value.replace(`https://${baseUrlToken}`, baseUrlToken)
    for (const [token, variable] of variables)
      value = value.replaceAll(token, variable)
    return value
  }
  const source = structuredClone(request)
  source.url = validationUrl
  if (
    source.postData.mimeType !== 'multipart/form-data'
    && source.postData.text !== undefined
  ) {
    source.postData = { mimeType: 'text/plain', text: source.postData.text }
  }
  const snippet = new HTTPSnippet(source)
  const prepared = snippet.requests[0]
  if (!prepared)
    throw new Error('HTTP snippet generation failed')
  // buildHarRequest already includes every query entry in the URL. Do not let
  // converters decode, serialize, or append these parameters a second time.
  prepared.url = restore(validationUrl)
  prepared.fullUrl = prepared.url
  prepared.queryObj = {}
  const search = validationUrl.split('#', 1)[0].match(/\?.*/)?.[0] ?? null
  prepared.uriObj.search = search
  prepared.uriObj.path = `${prepared.uriObj.pathname ?? '/'}${search ?? ''}`
  prepared.uriObj.href = validationUrl
  for (const key of [
    'auth',
    'hash',
    'host',
    'hostname',
    'href',
    'path',
    'pathname',
    'protocol',
    'port',
    'search',
  ] as const) {
    const value = prepared.uriObj[key]
    if (typeof value === 'string')
      prepared.uriObj[key] = restore(value)
  }
  prepared.uriObj.query = {}
  const result = snippet.convert(target.id, client.client)
  if (typeof result !== 'string')
    throw new Error('HTTP snippet generation failed')
  return result
}
