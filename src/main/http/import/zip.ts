import type { HttpImportFile } from './types'
import { Buffer } from 'node:buffer'
import JSZip from 'jszip'
import {
  importCountLimit,
  importFileLimit,
  importTotalLimit,
  validateImportFiles,
} from './limits'

function isZipFile(file: HttpImportFile): boolean {
  return file.name.toLowerCase().endsWith('.zip')
}

function decodeBase64(value: string): Buffer {
  return Buffer.from(value, 'base64')
}

export async function expandZipFiles(
  files: HttpImportFile[],
): Promise<HttpImportFile[]> {
  validateImportFiles(files)
  const expandedFiles: HttpImportFile[] = []
  let unpackedSize = 0

  for (const file of files) {
    if (!isZipFile(file)) {
      expandedFiles.push(file)
      continue
    }

    const zip = await JSZip.loadAsync(
      file.encoding === 'base64' ? decodeBase64(file.content) : file.content,
    )

    for (const [path, entry] of Object.entries(zip.files)) {
      if (entry.dir)
        continue

      const lowerPath = path.toLowerCase()
      if (
        !lowerPath.endsWith('.yml')
        && !lowerPath.endsWith('.yaml')
        && !lowerPath.endsWith('.json')
      ) {
        continue
      }

      if (expandedFiles.length >= importCountLimit)
        throw new Error('spaces.http.import.runtimeWarnings.fileLimit')
      let size = 0
      const chunks: Buffer[] = []
      await new Promise<void>((resolve, reject) => {
        const stream = entry.nodeStream()
        stream.on('data', (chunk: Buffer) => {
          size += chunk.length
          unpackedSize += chunk.length
          if (size > importFileLimit || unpackedSize > importTotalLimit) {
            stream.pause()
            reject(
              new Error('spaces.http.import.runtimeWarnings.invalidArchive'),
            )
            return
          }
          chunks.push(chunk)
        })
        stream.on('error', () =>
          reject(
            new Error('spaces.http.import.runtimeWarnings.invalidArchive'),
          ))
        stream.on('end', resolve)
      })
      expandedFiles.push({
        content: Buffer.concat(chunks).toString('utf8'),
        name: `${file.name}/${path}`,
      })
    }
  }

  return expandedFiles
}
