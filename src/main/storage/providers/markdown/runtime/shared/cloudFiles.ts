import type { Stats } from 'node:fs'
import fs from 'fs-extra'

export interface FileAvailability {
  exists: boolean
  /**
   * Файл виден в каталоге, но его содержимое ещё не скачано облачным
   * провайдером (iCloud Drive, Dropbox, OneDrive, Google Drive): чтение
   * такого файла блокируется до докачки из сети.
   */
  isCloudPlaceholder: boolean
  stats: Stats | null
}

// Плейсхолдер облачного провайдера сообщает через stat полный размер файла,
// но не занимает блоков на диске: на macOS у dataless-файла нет extents,
// на Windows у Cloud Filter placeholder нулевой AllocationSize. Сам stat
// содержимое не докачивает, поэтому проверка безопасна. Ложное срабатывание
// (например, resident-файл на NTFS) тоже безопасно: файл уйдёт в фоновую
// очередь докачки и мгновенно "докачается" обычным локальным чтением.
export function isCloudPlaceholderStats(stats: Stats): boolean {
  return stats.isFile() && stats.size > 0 && stats.blocks === 0
}

export function getFileAvailability(absolutePath: string): FileAvailability {
  try {
    const stats = fs.statSync(absolutePath)

    return {
      exists: stats.isFile() || stats.isDirectory(),
      isCloudPlaceholder: isCloudPlaceholderStats(stats),
      stats,
    }
  }
  catch {
    return {
      exists: false,
      isCloudPlaceholder: false,
      stats: null,
    }
  }
}
