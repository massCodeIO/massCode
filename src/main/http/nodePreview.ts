import type { HarRequest } from 'httpsnippet'

/** Generate Node code from the original request, without HAR body reserialization. */
export function generateNodePreview(
  request: HarRequest,
  client: 'native' | 'axios' | 'fetch',
): string {
  const quote = JSON.stringify
  const multipart = request.postData.mimeType === 'multipart/form-data'
  const headers = Object.fromEntries(
    request.headers
      .filter(
        header => !multipart || header.name.toLowerCase() !== 'content-type',
      )
      .map(header => [header.name, header.value]),
  )
  const lines: string[] = []
  if (client === 'native') {
    lines.push(
      'import http from "node:http";',
      'import https from "node:https";',
    )
  }
  if (client === 'axios')
    lines.push('import axios from "axios";')
  if (multipart && request.postData.params?.some(param => param.fileName))
    lines.push('import { readFile } from "node:fs/promises";')
  lines.push(
    '',
    `const url = new URL(${quote(request.url)});`,
    `const headers = ${JSON.stringify(headers, null, 2)};`,
  )
  let body = 'undefined'
  if (multipart) {
    lines.push('const form = new FormData();')
    for (const param of request.postData.params ?? []) {
      if (param.fileName) {
        lines.push(
          `form.append(${quote(param.name)}, new Blob([await readFile(${quote(param.fileName)})], { type: ${quote(param.contentType ?? 'application/octet-stream')} }), ${quote(param.fileName.split(/[\\/]/).pop())});`,
        )
      }
      else {
        lines.push(
          `form.append(${quote(param.name)}, ${quote(param.value ?? '')});`,
        )
      }
    }
    if (client === 'native') {
      lines.push(
        'const encodedForm = new Response(form);',
        'headers["Content-Type"] = encodedForm.headers.get("content-type");',
        'const body = Buffer.from(await encodedForm.arrayBuffer());',
      )
      body = 'body'
    }
    else {
      body = 'form'
    }
  }
  else if (request.postData.text !== undefined) {
    lines.push(`const body = ${quote(request.postData.text)};`)
    body = 'body'
  }
  lines.push('')
  if (client === 'native') {
    lines.push(
      'const transport = url.protocol === "https:" ? https : http;',
      `const request = transport.request(url, { method: ${quote(request.method)}, headers }, (response) => {`,
      '  const chunks = [];',
      '  response.on("data", (chunk) => chunks.push(chunk));',
      '  response.on("end", () => console.log(Buffer.concat(chunks).toString()));',
      '});',
      'request.on("error", console.error);',
      `request.end(${body});`,
    )
  }
  else if (client === 'axios') {
    lines.push(
      'const response = await axios.request({',
      '  url: url.href,',
      `  method: ${quote(request.method)},`,
      '  headers,',
      `  data: ${body},`,
      // Axios otherwise parses/re-serializes JSON strings and ignores scalar bodies.
      ...(multipart ? [] : ['  transformRequest: [(data) => data],']),
      '});',
      'console.log(response.data);',
    )
  }
  else {
    lines.push(
      `const response = await fetch(url, { method: ${quote(request.method)}, headers, body: ${body} });`,
      'console.log(await response.text());',
    )
  }
  return `${lines.join('\n').trim()}\n`
}
