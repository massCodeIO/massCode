import fs from 'fs-extra'
import { enqueueCloudDownload } from '../../cloudDownloads'
import { getFileAvailability } from './cloudFiles'

// Синхронное чтение служебного файла vault (state, метаданные папок) с
// защитой от облачных плейсхолдеров: чтение dataless-файла заблокировало бы
// main process до докачки из сети. Вместо блокировки файл ставится в
// очередь фоновой докачки, а каллеру бросается ошибка: текущий скан
// прерывается и повторяется после докачки через обычный sync-конвейер.
export function isCloudFileNotDownloadedError(error: unknown): boolean {
  return (
    error instanceof Error
    && error.message.startsWith('CLOUD_FILE_NOT_DOWNLOADED')
  )
}

export function readVaultTextFileSync(absolutePath: string): string {
  const availability = getFileAvailability(absolutePath)

  if (availability.isCloudPlaceholder) {
    enqueueCloudDownload(absolutePath)
    throw new Error(
      `CLOUD_FILE_NOT_DOWNLOADED:Vault file is not downloaded from cloud storage yet: ${absolutePath}`,
    )
  }

  return fs.readFileSync(absolutePath, 'utf8')
}
