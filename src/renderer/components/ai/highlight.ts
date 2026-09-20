import { LanguageDescription } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { classHighlighter, highlightTree } from '@lezer/highlight'

export function escapeCode(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function highlightCode(code: string, name: string) {
  const description = LanguageDescription.matchLanguageName(
    languages,
    name,
    false,
  )
  if (!description)
    return escapeCode(code)
  try {
    // LanguageDescription.load caches both the support and its pending promise.
    const support = await description.load()
    let html = ''
    let cursor = 0
    highlightTree(
      support.language.parser.parse(code),
      classHighlighter,
      (from, to, classes) => {
        html += escapeCode(code.slice(cursor, from))
        html += `<span class="${classes}">${escapeCode(code.slice(from, to))}</span>`
        cursor = to
      },
    )
    return html + escapeCode(code.slice(cursor))
  }
  catch {
    return escapeCode(code)
  }
}
