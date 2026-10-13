import fs from 'fs-extra'
import { vi } from 'vitest'

// Порядок обхода каталога не гарантирован: запись с заданным именем ставится
// первой, чтобы тест проверял неблагоприятный порядок явно. Шпион нужно
// снимать (mockRestore или vi.restoreAllMocks): vi.clearAllMocks его не снимает.
export function listEntryFirst(name: string) {
  const readdirSync = fs.readdirSync.bind(fs) as (
    ...args: unknown[]
  ) => unknown[]

  return vi.spyOn(fs, 'readdirSync').mockImplementation(((
    ...args: unknown[]
  ) => {
    const entries = readdirSync(...args)
    const index = entries.findIndex(
      entry =>
        (typeof entry === 'string' ? entry : (entry as fs.Dirent).name)
        === name,
    )
    if (index > 0) {
      entries.unshift(...entries.splice(index, 1))
    }
    return entries
  }) as typeof fs.readdirSync)
}
