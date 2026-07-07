import path from 'node:path'
import fs from 'fs-extra'
import yaml from 'js-yaml'
import {
  isCloudFileNotDownloadedError,
  readVaultTextFileSync,
} from './guardedRead'

export function readYamlObjectFile<T>(filePath: string): T | null {
  if (!fs.pathExistsSync(filePath)) {
    return null
  }

  try {
    // Guarded-чтение: недокачанный файл прерывает скан ошибкой, потому что
    // null здесь означал бы «метаданных нет» и привёл бы к их перезаписи
    // дефолтами поверх ещё не скачанной облачной версии.
    const source = readVaultTextFileSync(filePath)
    const parsed = yaml.load(source)

    if (!parsed || typeof parsed !== 'object') {
      return null
    }

    return parsed as T
  }
  catch (error) {
    if (isCloudFileNotDownloadedError(error)) {
      throw error
    }

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
