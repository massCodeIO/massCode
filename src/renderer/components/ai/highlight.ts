import { loadGrammars } from '@/components/editor/grammars'
import { languages } from '@/components/editor/grammars/languages'
import CodeMirror from 'codemirror'
import { themedHighlighters } from 'codemirror-textmate'

const aliases: Record<string, string> = {
  'js': 'javascript',
  'ts': 'typescript',
  'py': 'python',
  'rb': 'ruby',
  'bash': 'sh',
  'shell': 'sh',
  'shellscript': 'sh',
  'zsh': 'sh',
  'c': 'c_cpp',
  'cpp': 'c_cpp',
  'c++': 'c_cpp',
  'cs': 'csharp',
  'c#': 'csharp',
  'yml': 'yaml',
  'md': 'markdown',
  'text': 'plain_text',
  'plaintext': 'plain_text',
}

export function escapeCode(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function highlightCode(code: string, name: string) {
  const normalized = name.toLowerCase().trim()
  const language = languages.find(
    item =>
      item.value === (aliases[normalized] ?? normalized)
      || item.name.toLowerCase() === normalized,
  )
  if (!language?.grammar)
    return escapeCode(code)
  try {
    await loadGrammars()
    // Snippet themes use the default TextMate -> cm-* token mapping too.
    const tokenizer = await themedHighlighters
      .get('default')!
      .getTokenizer(language.value)
    // TextMate accepts null as the initial rule stack. Keep state per block,
    // across lines, never shared between concurrent answers.
    const state: Parameters<typeof tokenizer>[1] = {
      ruleStack: null!,
      tokensCache: [],
    }
    return code
      .split(/(\r\n|\r|\n)/)
      .map((line, index) => {
        if (index % 2)
          return line
        const stream = new CodeMirror.StringStream(line)
        let html = ''
        // Tokenize blank lines too, so multiline grammar state advances.
        do {
          const style = tokenizer(stream, state)
          const text = escapeCode(stream.current())
          html += style
            ? `<span class="${escapeCode(
              style
                .split(/\s+/)
                .map(token => `cm-${token}`)
                .join(' '),
            )}">${text}</span>`
            : text
          if (stream.pos <= stream.start && !stream.eol())
            return escapeCode(line)
          stream.start = stream.pos
        } while (!stream.eol())
        return html
      })
      .join('')
  }
  catch {
    return escapeCode(code)
  }
}
