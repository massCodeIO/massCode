import { randomBytes } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'
import fs from 'fs-extra'

// Windows не даёт заменить файл, открытый другим процессом без
// FILE_SHARE_DELETE (индексатор, антивирус, клиент OneDrive), хотя запись
// поверх такого файла проходит. Только в этом случае допустим откат
// к неатомарной записи: иначе сохранение падало бы там, где раньше работало.
const WINDOWS_LOCKED_RENAME_CODES = new Set(['EACCES', 'EBUSY', 'EPERM'])

function isWindowsLockedRename(error: unknown): boolean {
  return (
    process.platform === 'win32'
    && WINDOWS_LOCKED_RENAME_CODES.has(
      (error as NodeJS.ErrnoException)?.code ?? '',
    )
  )
}

// rename поверх симлинка заменил бы саму ссылку обычным файлом, поэтому
// временный файл кладётся рядом с реальной целью.
function resolveWriteTarget(absolutePath: string): string {
  try {
    return fs.lstatSync(absolutePath).isSymbolicLink()
      ? fs.realpathSync(absolutePath)
      : absolutePath
  }
  catch {
    return absolutePath
  }
}

function getExistingMode(absolutePath: string): number | null {
  try {
    return fs.statSync(absolutePath).mode & 0o7777
  }
  catch {
    return null
  }
}

// writeFileSync поверх файла сначала обрезает его: сбой посреди записи
// (ENOSPC, EIO) оставил бы на диске обрезанное содержимое. Здесь цель
// заменяется только полностью записанным временным файлом.
//
// Имя временного файла скрытое и не заканчивается на `.md`, поэтому скан
// vault его не подхватит, а watcher не увидит: chokidar с awaitWriteFinish
// не эмитит add для файла, исчезнувшего до стабилизации.
export function writeFileAtomicSync(
  absolutePath: string,
  content: string,
): void {
  const targetPath = resolveWriteTarget(absolutePath)
  const tempPath = path.join(
    path.dirname(targetPath),
    `.${path.basename(targetPath)}.${randomBytes(8).toString('hex')}.tmp`,
  )
  const mode = getExistingMode(targetPath)
  let tempCreated = false

  try {
    const fd = fs.openSync(tempPath, 'wx', mode ?? 0o666)
    tempCreated = true
    try {
      // Режим при open урезается umask: права существующего файла
      // восстанавливаются явно.
      if (mode !== null) {
        fs.fchmodSync(fd, mode)
      }
      fs.writeFileSync(fd, content, 'utf8')
    }
    finally {
      fs.closeSync(fd)
    }

    try {
      fs.renameSync(tempPath, targetPath)
      tempCreated = false
    }
    catch (error) {
      if (!isWindowsLockedRename(error)) {
        throw error
      }
      fs.writeFileSync(targetPath, content, 'utf8')
    }
  }
  finally {
    if (tempCreated) {
      try {
        fs.removeSync(tempPath)
      }
      catch {
        // Исходная ошибка записи важнее: осиротевший скрытый .tmp
        // не ломает скан и только занимает место.
      }
    }
  }
}
