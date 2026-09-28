import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, describe, expect, it } from 'vitest'
import { rememberAppFileChange, wasRecentAppFileChange } from '../appChanges'

const tempDirs: string[] = []

function createTempFilePath(): string {
  const dirPath = fs.mkdtempSync(path.join(os.tmpdir(), 'app-changes-'))
  tempDirs.push(dirPath)
  return path.join(dirPath, 'note.md')
}

afterEach(() => {
  for (const dirPath of tempDirs.splice(0)) {
    fs.removeSync(dirPath)
  }
})

describe('app file change echo suppression', () => {
  it('suppresses the echo of the app own write', () => {
    const filePath = createTempFilePath()
    fs.writeFileSync(filePath, 'own content', 'utf8')
    rememberAppFileChange(filePath)

    expect(wasRecentAppFileChange(filePath)).toBe(true)
  })

  it('does not suppress an external edit inside the TTL window', () => {
    const filePath = createTempFilePath()
    fs.writeFileSync(filePath, 'own content', 'utf8')
    rememberAppFileChange(filePath)

    // Внешняя правка того же файла в окне TTL меняет сигнатуру (размер) —
    // событие должно быть обработано, а не проглочено как эхо.
    fs.writeFileSync(filePath, 'external content with different size', 'utf8')

    expect(wasRecentAppFileChange(filePath)).toBe(false)
    // Запись о собственном изменении сброшена: повторные события тоже
    // не считаются эхом.
    expect(wasRecentAppFileChange(filePath)).toBe(false)
  })

  it('suppresses the echo of the app own deletion', () => {
    const filePath = createTempFilePath()
    fs.writeFileSync(filePath, 'own content', 'utf8')
    fs.removeSync(filePath)
    rememberAppFileChange(filePath)

    expect(wasRecentAppFileChange(filePath)).toBe(true)
  })

  it('does not suppress an external recreation after the app own deletion', () => {
    const filePath = createTempFilePath()
    fs.writeFileSync(filePath, 'own content', 'utf8')
    fs.removeSync(filePath)
    rememberAppFileChange(filePath)

    fs.writeFileSync(filePath, 'recreated externally', 'utf8')

    expect(wasRecentAppFileChange(filePath)).toBe(false)
  })
})
