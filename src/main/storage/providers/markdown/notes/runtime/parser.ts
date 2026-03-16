import type {
  NotesFolderMetadataFile,
  NotesFolderRecord,
  NotesPaths,
} from './types'
import path from 'node:path'
import fs from 'fs-extra'
import yaml from 'js-yaml'
import { readYamlObjectFile } from '../../runtime/parser'
import { META_FILE_NAME } from './constants'

export function readNotesFolderMetadata(
  paths: NotesPaths,
  folderRelativePath: string,
): NotesFolderMetadataFile {
  const folderAbsPath = path.join(paths.notesRoot, folderRelativePath)
  const metaPath = path.join(folderAbsPath, META_FILE_NAME)

  const metaData = readYamlObjectFile<NotesFolderMetadataFile>(metaPath)
  if (metaData) {
    return metaData
  }

  return {}
}

export function serializeNotesFolderMetadata(
  folder: NotesFolderRecord,
): Record<string, unknown> {
  return {
    id: folder.id,
    createdAt: folder.createdAt,
    icon: folder.icon,
    name: folder.name,
    orderIndex: folder.orderIndex,
    updatedAt: folder.updatedAt,
  }
}

export function writeNotesFolderMetadataFile(
  paths: NotesPaths,
  folderRelativePath: string,
  folder: NotesFolderRecord,
): void {
  const folderAbsPath = path.join(paths.notesRoot, folderRelativePath)
  const metaPath = path.join(folderAbsPath, META_FILE_NAME)
  const payload = serializeNotesFolderMetadata(folder)

  const body = yaml
    .dump(payload, {
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
    })
    .trim()

  const nextContent = `${body}\n`

  if (fs.pathExistsSync(metaPath)) {
    const currentContent = fs.readFileSync(metaPath, 'utf8')
    if (currentContent === nextContent) {
      return
    }
  }

  fs.ensureDirSync(folderAbsPath)
  fs.writeFileSync(metaPath, nextContent, 'utf8')
}
