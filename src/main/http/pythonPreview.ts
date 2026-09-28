import type { HarRequest } from 'httpsnippet'

export function generatePythonRequestsPreview(request: HarRequest): string {
  const quote = JSON.stringify
  const multipart = request.postData.mimeType === 'multipart/form-data'
  const headers = request.headers.filter(
    header => !multipart || header.name.toLowerCase() !== 'content-type',
  )
  const lines = [
    'import requests',
    ...(multipart ? ['from contextlib import ExitStack'] : []),
    '',
    `url = ${quote(request.url)}`,
    'headers = {',
  ]
  for (const header of headers)
    lines.push(`    ${quote(header.name)}: ${quote(header.value)},`)
  lines.push('}')
  if (multipart && !request.postData.params?.length) {
    lines.push(
      'headers["Content-Type"] = "multipart/form-data; boundary=masscode-boundary"',
      `response = requests.request(${quote(request.method)}, url, headers=headers, data=b"--masscode-boundary--\\r\\n")`,
    )
  }
  else if (multipart) {
    lines.push('', 'with ExitStack() as stack:', '    files = []')
    for (const param of request.postData.params ?? []) {
      if (param.fileName) {
        const filename = param.fileName.split(/[\\/]/).pop() ?? ''
        lines.push(
          `    files.append((${quote(param.name)}, (${quote(filename)}, stack.enter_context(open(${quote(param.fileName)}, "rb")), ${quote(param.contentType ?? 'application/octet-stream')})))`,
        )
      }
      else {
        lines.push(
          `    files.append((${quote(param.name)}, (None, ${quote(param.value ?? '')})))`,
        )
      }
    }
    lines.push(
      `    response = requests.request(${quote(request.method)}, url, headers=headers, files=files)`,
    )
  }
  else {
    lines.push('')
    if (request.postData.text !== undefined)
      lines.push(`body = ${quote(request.postData.text)}.encode("utf-8")`)
    lines.push(
      `response = requests.request(${quote(request.method)}, url, headers=headers${request.postData.text !== undefined ? ', data=body' : ''})`,
    )
  }
  lines.push('print(response.text)')
  return `${lines.join('\n')}\n`
}
