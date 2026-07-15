import { parseNotesAssetName } from './assets'

const NOTES_ASSET_URL_PATTERN = /masscode:\/\/notes-asset\/([^\s)<>'"]+)/g

export function extractNotesAssetNames(source: string): Set<string> {
  const fileNames = new Set<string>()

  for (const match of source.matchAll(NOTES_ASSET_URL_PATTERN)) {
    const parsedName = parseNotesAssetName(match[1])
    if (parsedName) {
      fileNames.add(parsedName.fileName)
    }
  }

  return fileNames
}
