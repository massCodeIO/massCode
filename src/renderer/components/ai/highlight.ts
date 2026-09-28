import { codeHighlighter } from '@/components/cm-extensions/codeHighlight'
import { loadLanguageSupport } from '@/components/editor/grammars'
import { highlightTree } from '@lezer/highlight'

export function escapeCode(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function highlightCode(code: string, name: string) {
  try {
    const support = await loadLanguageSupport(name)
    if (!support)
      return escapeCode(code)
    const tree = support.language.parser.parse(code)
    let html = ''
    let position = 0
    highlightTree(tree, codeHighlighter, (from, to, classes) => {
      html += escapeCode(code.slice(position, from))
      html += code
        .slice(from, to)
        .split(/(\r\n|\r|\n)/)
        .map((part, index) =>
          index % 2
            ? part
            : `<span class="${classes}">${escapeCode(part)}</span>`,
        )
        .join('')
      position = to
    })
    return html + escapeCode(code.slice(position))
  }
  catch {
    return escapeCode(code)
  }
}
