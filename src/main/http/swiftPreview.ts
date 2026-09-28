import type { HarRequest } from 'httpsnippet'

function quote(value: string): string {
  return `"${[...value]
    .map((char) => {
      if (char === '\\')
        return '\\\\'
      if (char === '"')
        return '\\"'
      if (char.codePointAt(0)! < 32)
        return `\\u{${char.codePointAt(0)!.toString(16)}}`
      return char
    })
    .join('')}"`
}

export function generateSwiftPreview(request: HarRequest): string {
  const multipart = request.postData.mimeType === 'multipart/form-data'
  const lines = [
    'import Foundation',
    '',
    `let url = URL(string: ${quote(request.url)})!`,
    'var request = URLRequest(url: url)',
    `request.httpMethod = ${quote(request.method)}`,
  ]
  for (const header of request.headers) {
    if (multipart && header.name.toLowerCase() === 'content-type')
      continue
    lines.push(
      `request.setValue(${quote(header.value)}, forHTTPHeaderField: ${quote(header.name)})`,
    )
  }
  if (multipart) {
    lines.push(
      '',
      'let boundary = UUID().uuidString',
      'request.setValue("multipart/form-data; boundary=\\(boundary)", forHTTPHeaderField: "Content-Type")',
      'var body = Data()',
    )
    for (const param of request.postData.params ?? []) {
      const name = param.name
        .replaceAll('"', '%22')
        .replaceAll('\r', '%0D')
        .replaceAll('\n', '%0A')
      lines.push('body.append(Data("--\\(boundary)\\r\\n".utf8))')
      if (param.fileName) {
        const fileName = (param.fileName.split(/[\\/]/).pop() ?? '')
          .replaceAll('"', '%22')
          .replaceAll('\r', '%0D')
          .replaceAll('\n', '%0A')
        lines.push(
          `body.append(Data(${quote(`Content-Disposition: form-data; name="${name}"; filename="${fileName}"\r\nContent-Type: ${param.contentType ?? 'application/octet-stream'}\r\n\r\n`)}.utf8))`,
          `body.append(try Data(contentsOf: URL(fileURLWithPath: ${quote(param.fileName)})))`,
        )
      }
      else {
        lines.push(
          `body.append(Data(${quote(`Content-Disposition: form-data; name="${name}"\r\n\r\n${param.value ?? ''}`)}.utf8))`,
        )
      }
      lines.push('body.append(Data("\\r\\n".utf8))')
    }
    lines.push(
      'body.append(Data("--\\(boundary)--\\r\\n".utf8))',
      'request.httpBody = body',
    )
  }
  else if (request.postData.text !== undefined) {
    lines.push(`request.httpBody = Data(${quote(request.postData.text)}.utf8)`)
  }
  lines.push(
    '',
    'let (data, response) = try await URLSession.shared.data(for: request)',
    'print(String(decoding: data, as: UTF8.self))',
  )
  return `${lines.join('\n')}\n`
}
