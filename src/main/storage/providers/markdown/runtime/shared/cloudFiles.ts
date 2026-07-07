import type { Stats } from 'node:fs'
import { spawnSync } from 'node:child_process'
import process from 'node:process'
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

const SF_DATALESS = 0x40000000

type DatalessProbe = (absolutePath: string, stats: Stats) => boolean

// Переопределение точной проверки dataless для тестов: sparse-файлы
// воспроизводят сигнатуру плейсхолдера, но не имеют флага SF_DATALESS.
let datalessProbeOverride: DatalessProbe | null = null

export function setDatalessProbeForTests(probe: DatalessProbe | null): void {
  datalessProbeOverride = probe
}

// Файлы, у которых сигнатура плейсхолдера (size > 0, blocks === 0) оказалась
// ложной: их содержимое успешно прочитано (inline-файлы btrfs, resident-файлы
// NTFS, сетевые шары с нулевым AllocationSize). Ключ — путь, значение —
// size и mtime на момент проверки: изменение файла сбрасывает исключение.
const readableZeroBlockFiles = new Map<
  string,
  { mtimeMs: number, size: number }
>()

// Кэш точной проверки SF_DATALESS на macOS: spawn стоит миллисекунды, но
// повторные сканы не должны платить её за каждый файл заново.
const datalessCheckCache = new Map<
  string,
  { isDataless: boolean, mtimeMs: number, size: number }
>()

export function markFileReadableDespiteZeroBlocks(
  absolutePath: string,
  stats: Stats,
): void {
  readableZeroBlockFiles.set(absolutePath, {
    mtimeMs: stats.mtimeMs,
    size: stats.size,
  })
}

export function resetCloudFileExemptions(): void {
  readableZeroBlockFiles.clear()
  datalessCheckCache.clear()
}

function hasPlaceholderSignature(stats: Stats): boolean {
  return stats.isFile() && stats.size > 0 && stats.blocks === 0
}

// Точная проверка на macOS: у настоящего dataless-файла File Provider ядро
// выставляет флаг SF_DATALESS в st_flags. Node не пробрасывает st_flags в
// fs.Stats, поэтому используется системный /usr/bin/stat. Вызов происходит
// только для файлов с сигнатурой плейсхолдера и кэшируется по size+mtime.
function isDatalessOnMacos(absolutePath: string, stats: Stats): boolean {
  const cached = datalessCheckCache.get(absolutePath)
  if (
    cached
    && cached.mtimeMs === stats.mtimeMs
    && cached.size === stats.size
  ) {
    return cached.isDataless
  }

  let isDataless = true
  try {
    const result = spawnSync('/usr/bin/stat', ['-f', '%Xf', absolutePath], {
      encoding: 'utf8',
      timeout: 3_000,
    })

    if (result.status === 0) {
      const flags = Number.parseInt(result.stdout.trim(), 16)
      isDataless = Number.isFinite(flags) && (flags & SF_DATALESS) !== 0
    }
  }
  catch {
    // При сбое проверки консервативно считаем файл плейсхолдером:
    // это не теряет данные, а лишь отправляет файл в фоновую докачку.
  }

  datalessCheckCache.set(absolutePath, {
    isDataless,
    mtimeMs: stats.mtimeMs,
    size: stats.size,
  })

  return isDataless
}

// Плейсхолдер облачного провайдера сообщает через stat полный размер файла,
// но не занимает блоков на диске: на macOS у dataless-файла нет extents,
// на Windows у Cloud Filter placeholder нулевой AllocationSize. Сам stat
// содержимое не докачивает, поэтому проверка безопасна. Ложные срабатывания
// (inline/resident-файлы) отсекаются точной проверкой SF_DATALESS на macOS
// и registry успешно прочитанных файлов на остальных платформах.
export function isCloudPlaceholderStats(stats: Stats): boolean {
  return hasPlaceholderSignature(stats)
}

export function getFileAvailability(absolutePath: string): FileAvailability {
  try {
    const stats = fs.statSync(absolutePath)
    let isCloudPlaceholder = hasPlaceholderSignature(stats)

    if (isCloudPlaceholder) {
      const exemption = readableZeroBlockFiles.get(absolutePath)

      if (
        exemption
        && exemption.mtimeMs === stats.mtimeMs
        && exemption.size === stats.size
      ) {
        isCloudPlaceholder = false
      }
      else if (datalessProbeOverride) {
        isCloudPlaceholder = datalessProbeOverride(absolutePath, stats)
      }
      else if (process.platform === 'darwin') {
        isCloudPlaceholder = isDatalessOnMacos(absolutePath, stats)
      }
    }

    return {
      exists: stats.isFile() || stats.isDirectory(),
      isCloudPlaceholder,
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
