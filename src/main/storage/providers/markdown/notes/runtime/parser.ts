import type {
  NotesFolderMetadataFile,
  NotesFolderRecord,
  NotesPaths,
} from './types'
import path from 'node:path'
import fs from 'fs-extra'
import yaml from 'js-yaml'
import { enqueueCloudDownload } from '../../cloudDownloads'
import { rememberAppFileChange } from '../../runtime/shared/appChanges'
import { getFileAvailability } from '../../runtime/shared/cloudFiles'
import {
  isYamlFileCloudUnavailable,
  readYamlObjectFile,
} from '../../runtime/shared/yaml'
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

  // Недокачанный .meta.yaml — не «метаданных нет»: id папки существует, но
  // сейчас неизвестен. Явный маркер запрещает вызывающему чеканить новый id.
  if (isYamlFileCloudUnavailable(metaPath)) {
    return { unavailable: true }
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
  const availability = getFileAvailability(metaPath)

  // Запись в недокачанный .meta.yaml затёрла бы облачные метаданные папки
  // (включая её id): файл сначала докачивается в фоне.
  if (availability.isCloudPlaceholder) {
    enqueueCloudDownload(metaPath)
    return
  }

  if (availability.exists) {
    const currentContent = fs.readFileSync(metaPath, 'utf8')
    if (currentContent === nextContent) {
      return
    }
  }

  fs.ensureDirSync(folderAbsPath)
  fs.writeFileSync(metaPath, nextContent, 'utf8')
  rememberAppFileChange(metaPath)
}
