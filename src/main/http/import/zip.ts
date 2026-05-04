import type { HttpImportFile } from './types'
import { Buffer } from 'node:buffer'
import JSZip from 'jszip'

function isZipFile(file: HttpImportFile): boolean {
  return file.name.toLowerCase().endsWith('.zip')
}

function decodeBase64(value: string): Buffer {
  return Buffer.from(value, 'base64')
}

export async function expandZipFiles(
  files: HttpImportFile[],
): Promise<HttpImportFile[]> {
  const expandedFiles: HttpImportFile[] = []

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

      expandedFiles.push({
        content: await entry.async('string'),
        name: `${file.name}/${path}`,
      })
    }
  }

  return expandedFiles
}
