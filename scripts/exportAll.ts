import type { Snippet } from '../src/shared/types/main/db'
import { CodeContext } from './codeContext'
import { existsSync, mkdir, writeFile } from 'fs'
import path from 'path'
import { FILES_SUFFIX } from '../src/main/constants'
export const exportAllSnippets = (snippets: Snippet[], targetPath: string) => {
  if (snippets.length === 0) {
    return
  }
  const cwd = path.join(targetPath, 'snippets')
  for (let i = 0; i < snippets.length; i++) {
    const snippetContents = snippets[i].content
    const suffix = FILES_SUFFIX[snippets[i].content[0].language]
    const code = new CodeContext()
    for (let j = 0; j < snippetContents.length; j++) {
      code.pushCode(snippetContents[j].value)
      code.newLine()
    }
    if (existsSync(cwd)) {
      const filePath = path.join(cwd, `${snippets[i].name}${suffix}`)
      exportFile(filePath, code.getCode())
    } else {
      mkdir(cwd, () => {
        const filePath = path.join(cwd, `${snippets[i].name}${suffix}`)
        exportFile(filePath, code.getCode())
      })
    }
  }
}

const exportFile = (path: string, code: string) => {
  writeFile(path, code, () => {
    console.log('finish', path)
  })
}
