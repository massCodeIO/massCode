import path from 'node:path'
import fs from 'fs-extra'
import yaml from 'js-yaml'
import { enqueueCloudDownload } from '../../cloudDownloads'
import { getFileAvailability } from './cloudFiles'

export function readYamlObjectFile<T>(filePath: string): T | null {
  const availability = getFileAvailability(filePath)

  if (!availability.exists) {
    return null
  }

  // Недокачанный метаданные-файл не прерывает скан: он уходит в фоновую
  // докачку, а до неё папка живёт на данных из state (id сохраняется по
  // пути). Перезапись дефолтами исключена: writeFolderMetadataFile не пишет
  // в плейсхолдеры.
  if (availability.isCloudPlaceholder) {
    enqueueCloudDownload(filePath)
    return null
  }

  try {
    const source = fs.readFileSync(filePath, 'utf8')
    const parsed = yaml.load(source)

    if (!parsed || typeof parsed !== 'object') {
      return null
    }

    return parsed as T
  }
  catch {
    return null
  }
}

export function writeYamlObjectFile(
  filePath: string,
  data: Record<string, unknown>,
): void {
  const body = yaml
    .dump(data, {
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
    })
    .trim()

  fs.ensureDirSync(path.dirname(filePath))
  fs.writeFileSync(filePath, `${body}\n`, 'utf8')
}
