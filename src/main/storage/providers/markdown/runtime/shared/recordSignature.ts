import type { RecordSignature } from '../../../../contracts'

interface SignedEntity {
  id: number
  folderId: number | null
  isDeleted: number
  updatedAt: number
  pendingCloudDownload?: boolean
}

// Общая сборка сигнатур для сниппетов, заметок и HTTP-запросов: записи индекса state дают
// mtimeMs/size последнего чтения файла, runtime-запись — updatedAt правки из приложения.
// Имя папки записи ищется словами: переименование папки не трогает ни файл, ни updatedAt записи.
export function buildRecordSignatures(
  entries: { id: number, meta?: { mtimeMs: number, size: number } }[],
  entityById: (id: number) => SignedEntity | undefined,
  folders: { id: number, name: string }[],
): Map<number, RecordSignature> {
  const folderNames = new Map(
    folders.map(folder => [folder.id, folder.name]),
  )
  const signatures = new Map<number, RecordSignature>()
  for (const entry of entries) {
    const entity = entityById(entry.id)
    if (!entity || entity.isDeleted)
      continue
    signatures.set(entity.id, {
      // Без метаданных (запись создана в этой сессии) правки приложения видны по updatedAt,
      // а внешняя правка проходит через ресинк, который метаданные запишет.
      sig: `${
        entry.meta
          ? `${entry.meta.mtimeMs}:${entry.meta.size}:${entity.updatedAt}`
          : `u:${entity.updatedAt}`
      }|${entity.folderId === null ? '' : (folderNames.get(entity.folderId) ?? '')}`,
      pendingCloudDownload: entity.pendingCloudDownload === true,
    })
  }
  return signatures
}
