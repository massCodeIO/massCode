import fs from 'fs-extra'
import { enqueueCloudDownload } from '../../cloudDownloads'
import { getFileAvailability } from './cloudFiles'

interface CloudAwareEntity {
  pendingCloudDownload?: boolean
}

export function throwCloudContentUnavailable(): never {
  throw new Error(
    'CLOUD_FILE_NOT_DOWNLOADED:This item is still downloading from cloud storage. Try again once the download completes.',
  )
}

// Мутации сущности, чей файл ещё не скачан облачным провайдером, запрещены
// до докачки: содержимое файла неизвестно, поэтому запись на диск затёрла бы
// облачные данные, а «принятая» без записи правка молча потерялась бы при
// докачке. Ошибка бросается до изменения in-memory кэша.
export function assertEntityContentAvailable(
  entity: CloudAwareEntity | null | undefined,
): void {
  if (entity?.pendingCloudDownload) {
    throwCloudContentUnavailable()
  }
}

// Свежая проверка при выдаче записи наружу: файл мог быть выгружен уже
// после гидрации, и запись в памяти выглядит полной. Плейсхолдер на диске
// помечает запись pending (UI блокирует редактирование оверлеем вместо
// приёма правок, которые отклонятся с 503) и ставит файл в докачку; флаг
// снимет ресинк после докачки. Возвращает true, если запись помечена.
export function markEntityPendingIfEvicted(
  absolutePath: string,
  entity: CloudAwareEntity | null | undefined,
): boolean {
  if (!entity || entity.pendingCloudDownload) {
    return false
  }

  if (!getFileAvailability(absolutePath).isCloudPlaceholder) {
    return false
  }

  entity.pendingCloudDownload = true
  enqueueCloudDownload(absolutePath)

  return true
}

// То же, но со свежим stat диска: флаг pendingCloudDownload устаревает, если
// провайдер выгрузил файл после гидрации (iCloud «Optimize Storage»).
// Вызывается до изменения runtime-кэша, чтобы мутация не «повисала» в памяти
// при отклонённой записи — окно расхождения сужается до stat-vs-write.
// Отсутствующий файл не блокирует: запись создаст его заново.
export function assertEntityFileWritable(
  absolutePath: string,
  entity: CloudAwareEntity | null | undefined,
): void {
  assertEntityContentAvailable(entity)

  // Явный stat перед проверкой плейсхолдера: getFileAvailability превращает
  // любую stat-ошибку в exists:false, и EIO/EACCES проходил бы guard как
  // «файла нет». Отсутствующий файл (подтверждённый ENOENT) не блокирует:
  // запись создаст его заново.
  try {
    fs.statSync(absolutePath)
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return
    }
    throw error
  }

  if (getFileAvailability(absolutePath).isCloudPlaceholder) {
    enqueueCloudDownload(absolutePath)
    throwCloudContentUnavailable()
  }
}
