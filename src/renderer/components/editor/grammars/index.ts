import type { LanguageSupport } from '@codemirror/language'
import { LanguageDescription } from '@codemirror/language'
import { languages as nativeLanguages } from '@codemirror/language-data'
import { languages } from './languages'
import {
  correctNativeHighlight,
  loadCorrectedStreamLanguage,
} from './nativeHighlight'

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
  'plain': 'plain_text',
}
const nativeAliases: Record<string, string> = {
  c_cpp: 'C++',
  csharp: 'C#',
  golang: 'Go',
  sh: 'Shell',
  coffee: 'CoffeeScript',
  objectivec: 'Objective-C',
  fsharp: 'F#',
  vbscript: 'VBScript',
}
const cache = new Map<string, Promise<LanguageSupport | undefined>>()

export function loadLanguageSupport(
  name = 'plain_text',
): Promise<LanguageSupport | undefined> {
  const normalized = name.trim().toLowerCase()
  const id = aliases[normalized] ?? normalized
  if (id === 'plain_text')
    return Promise.resolve(undefined)
  let pending = cache.get(id)
  if (!pending) {
    pending = (async () => {
      const corrected = await loadCorrectedStreamLanguage(id)
      if (corrected)
        return corrected
      const native = LanguageDescription.matchLanguageName(
        nativeLanguages,
        nativeAliases[id] ?? id,
        false,
      )
      // These native modes lose snippet constructs covered by the language corpus
      // (for example C++ macro values, YAML scalars, or TOML base-prefixed integers).
      if (
        native
        && ![
          // These stream modes consume interpolated expressions as string text.
          'csharp',
          'haxe',
          'julia',
          'livescript',
          'perl',
          'smalltalk',
          'django',
          'razor',
          'php_laravel_blade',
          'php',
          'markdown',
          'json5',
          'pig',
          'tcl',
          'gherkin',
          'cobol',
          'yaml',
          'toml',
          'c_cpp',
          'lua',
        ].includes(id)
      ) {
        return correctNativeHighlight(id, await native.load())
      }
      const entry = languages.find(
        item => item.value === id || item.name.toLowerCase() === id,
      )
      if (!entry?.scopeName || !entry.grammar)
        return undefined
      const { loadTextMateLanguage } = await import('./textmate')
      return loadTextMateLanguage(entry.scopeName)
    })()
    cache.set(id, pending)
    pending.catch(() => cache.delete(id))
  }
  return pending
}
