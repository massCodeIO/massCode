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
